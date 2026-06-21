import type {
  Discipline,
  Player,
  PlayerGeneratorAxisIntentValue,
  PlayerGeneratorAxisSource,
  PlayerGeneratorAttributeName,
  PlayerGeneratorAttributes,
  PlayerGeneratorArchetype,
  PlayerGeneratorClassSuggestion,
  PlayerGeneratorDraft,
  PlayerGeneratorInput,
  PlayerGeneratorMatchState,
  PlayerGeneratorRandomness,
  PlayerGeneratorResolvedAxisIntent,
  PlayerGeneratorRoleIntent,
  PlayerGeneratorStrengthTier,
  PlayerGeneratorValidationStatus,
  Team,
  TeamGeneralManagerProfile,
  TeamIdentity,
} from "@/lib/data/olyDataTypes";
import { normalizePlayerOvr } from "@/lib/data/player-ovr-scale";
import { deriveTeamIdentityAxisWeightMap } from "@/lib/foundation/team-identity-settings";
import { resolveSlotRolesForDiscipline, type MatchdaySlotRoleDefinition } from "@/lib/lineups/matchday-slot-roles";
import { loadPlayerFormulaSources } from "@/lib/player-formulas/formula-source-loader";
import { calculateSalaryFromMarketValue } from "@/lib/player-formulas/salary-engine";
import { officialDisciplineWeightMatrix, playerGeneratorAttributeKeys, type PlayerGeneratorAttributeKey } from "@/lib/player-generator/official-discipline-weights";
import { playerGeneratorArchetypes, type PlayerGeneratorArchetypeConstraint } from "@/lib/player-generator/player-generator-archetypes";
import {
  darkSupportArchetypes,
  playerGeneratorRoleProfiles,
  type PlayerGeneratorAxisKey,
  type PlayerGeneratorRoleProfile,
} from "@/lib/player-generator/player-generator-role-profiles";

type PlayerGeneratorCatalog = {
  classes: string[];
  races: string[];
  subclasses: string[];
  positiveTraits: string[];
  negativeTraits: string[];
};

type StrengthTierProfile = {
  center: number;
  min: number;
  max: number;
  spreadFloor: number;
};

type RandomnessProfile = {
  attributeJitter: number;
  axisJitter: number;
  shapeJitter: number;
};

type ValidationDiagnostics = PlayerGeneratorDraft["generated"]["diagnostics"];

type ResolvedAxisIntentBundle = {
  resolvedAxisIntent: PlayerGeneratorResolvedAxisIntent;
  axisIntentSources: Record<PlayerGeneratorAxisKey, PlayerGeneratorAxisSource>;
};

type ValidationResult = {
  warnings: string[];
  diagnostics: ValidationDiagnostics;
  validationStatus: PlayerGeneratorValidationStatus;
  qualityScore: number;
};

export type PlayerGeneratorTeamContext = {
  team: Team | null;
  identity: TeamIdentity | null;
  generalManager: TeamGeneralManagerProfile | null;
  rosterCount: number;
  averageSalary: number | null;
};

const defaultInput: PlayerGeneratorInput = {
  name: "",
  roleIntent: "allround",
  strengthTier: "normal",
  axisIntent: {
    pow: "auto",
    spe: "auto",
    men: "auto",
    soc: "auto",
  },
  randomness: "medium",
  preferredArchetype: null,
  targetTeamId: null,
  contractMode: "balanced",
  raceHint: null,
  classHint: null,
  traitHint: null,
  seed: "draft-seed-001",
};

const strengthProfiles: Record<PlayerGeneratorStrengthTier, StrengthTierProfile> = {
  very_weak: { center: 18, min: 5, max: 30, spreadFloor: 18 },
  weak: { center: 30, min: 15, max: 45, spreadFloor: 20 },
  normal: { center: 50, min: 25, max: 65, spreadFloor: 20 },
  strong: { center: 66, min: 45, max: 80, spreadFloor: 22 },
  elite: { center: 80, min: 60, max: 92, spreadFloor: 25 },
  legendary: { center: 92, min: 75, max: 99, spreadFloor: 25 },
};

const randomnessProfiles: Record<PlayerGeneratorRandomness, RandomnessProfile> = {
  low: { attributeJitter: 3, axisJitter: 2, shapeJitter: 2 },
  medium: { attributeJitter: 7, axisJitter: 5, shapeJitter: 5 },
  high: { attributeJitter: 13, axisJitter: 9, shapeJitter: 10 },
};

const attributeAxisBlend: Record<PlayerGeneratorAttributeKey, Record<PlayerGeneratorAxisKey, number>> = {
  power: { pow: 0.75, spe: 0.08, men: 0.05, soc: 0.12 },
  health: { pow: 0.6, spe: 0.12, men: 0.16, soc: 0.12 },
  stamina: { pow: 0.38, spe: 0.3, men: 0.18, soc: 0.14 },
  intelligence: { pow: 0.05, spe: 0.1, men: 0.76, soc: 0.09 },
  awareness: { pow: 0.08, spe: 0.28, men: 0.48, soc: 0.16 },
  determination: { pow: 0.22, spe: 0.14, men: 0.42, soc: 0.22 },
  speed: { pow: 0.05, spe: 0.78, men: 0.08, soc: 0.09 },
  dexterity: { pow: 0.04, spe: 0.81, men: 0.05, soc: 0.1 },
  charisma: { pow: 0.04, spe: 0.05, men: 0.16, soc: 0.75 },
  will: { pow: 0.14, spe: 0.1, men: 0.46, soc: 0.3 },
  spirit: { pow: 0.04, spe: 0.05, men: 0.28, soc: 0.63 },
  torment: { pow: 0.22, spe: 0.09, men: 0.18, soc: 0.51 },
};

const classAxisProfiles: Array<{
  keywords: string[];
  profileId: string;
  fallback: string;
  weight: (axes: Record<PlayerGeneratorAxisKey, number>) => number;
}> = [
  {
    profileId: "mage",
    keywords: ["mage", "tactician", "overseer", "templar", "hero"],
    fallback: "Mage",
    weight: (axes) => axes.men * 1.08 + axes.soc * 0.2 - axes.pow * 0.06,
  },
  {
    profileId: "rogue",
    keywords: ["rogue", "sprinter", "overseer"],
    fallback: "Rogue",
    weight: (axes) => axes.spe * 1.14 + axes.men * 0.12,
  },
  {
    profileId: "tank",
    keywords: ["tank", "templar", "warlord", "hero"],
    fallback: "Tank",
    weight: (axes) => axes.pow * 1.08 + axes.men * 0.24 - axes.spe * 0.04,
  },
  {
    profileId: "support",
    keywords: ["bard", "hero", "overseer", "mage", "tactician", "templar"],
    fallback: "Bard",
    weight: (axes) => axes.soc * 1.12 + axes.men * 0.32,
  },
  {
    profileId: "warrior",
    keywords: ["warlord", "berserker", "charger", "badass", "templar"],
    fallback: "Warlord",
    weight: (axes) => axes.pow * 0.82 + axes.spe * 0.28 + axes.men * 0.12,
  },
];

const fallbackPositiveTraits = ["Disciplined", "Leader", "Resourceful", "Motivated", "Flexible", "Cool"];
const fallbackNegativeTraits = ["Feisty", "Obsessive", "Paranoid", "Mercenary", "Timid", "Scandalous"];
const fallbackRaces = ["Human", "Demon", "Construct", "Divine", "Animal", "Voidborn"];
const fallbackClasses = ["Warlord", "Mage", "Rogue", "Tank", "Bard", "Overseer"];
const fallbackSubclasses = ["Warrior", "Scout", "Strategist", "Guardian", "Healer", "Assassin"];
const namePrefixes = ["Ar", "Bel", "Cor", "Dra", "El", "Fen", "Gra", "Hel", "Ira", "Kor", "Lun", "Mor", "Ny", "Or", "Pra", "Riv", "Syl", "Tor", "Umb", "Val"];
const nameSuffixes = ["ador", "aris", "eon", "ion", "ara", "or", "eth", "ius", "vek", "wyn", "ael", "grim", "ora", "yx"];
const invalidCatalogEntries = new Set(["#N/A", "Unknown", "Klasse", "null", "undefined"]);
const playerFormulaSources = loadPlayerFormulaSources();

function buildFormulaStatusSnapshot() {
  return {
    attributeSalaryModifiersStatus: playerFormulaSources.attributeSalaryModifiersStatus,
    traitSalaryFactorsStatus: playerFormulaSources.traitSalaryFactorsStatus,
    rankMarketValueStatus: playerFormulaSources.rankMarketValueStatus,
    classFactorsStatus: playerFormulaSources.classFactorsStatus,
    marketValueEngineStatus: playerFormulaSources.marketValueEngineStatus,
    salaryEngineStatus: playerFormulaSources.salaryEngineStatus,
    classEngineStatus: playerFormulaSources.classEngineStatus,
    warnings: [...playerFormulaSources.warnings],
  };
}

function describeSourceWarning(status: "ready" | "missing_source" | "incomplete_source" | "blocked", base: string) {
  if (status === "incomplete_source") {
    return `${base}_source_incomplete`;
  }
  if (status === "missing_source") {
    return `${base}_source_missing`;
  }
  if (status === "blocked") {
    return `${base}_source_blocked`;
  }
  return null;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function roundValue(value: number, digits = 1) {
  return Number(value.toFixed(digits));
}

function toSlug(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createSeededRng(seed: string) {
  let state = hashString(seed) || 1;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickOne<T>(items: T[], rng: () => number, fallback: T) {
  if (items.length === 0) {
    return fallback;
  }
  const index = Math.floor(rng() * items.length);
  return items[index] ?? fallback;
}

function uniqueSorted(values: Array<string | null | undefined>) {
  return [
    ...new Set(
      values
        .map((value) => value?.trim())
        .filter((value): value is string => {
          if (!value) {
            return false;
          }
          return !invalidCatalogEntries.has(value);
        }),
    ),
  ]
    .sort((left, right) => left.localeCompare(right, "de"));
}

function pushUnique<T>(items: T[], value: T | null | undefined) {
  if (value == null || items.includes(value)) {
    return;
  }
  items.push(value);
}

function normalizeAxisIntent(value: PlayerGeneratorAxisIntentValue | undefined) {
  if (value == null || value === "auto") {
    return null;
  }
  return clamp(Math.round(value), 1, 5) as 1 | 2 | 3 | 4 | 5;
}

function getRoleAxisTemplate(roleIntent: PlayerGeneratorRoleIntent): PlayerGeneratorResolvedAxisIntent {
  switch (roleIntent) {
    case "offense":
      return { pow: 5, spe: 4, men: 1, soc: 1 };
    case "defense":
      return { pow: 3, spe: 2, men: 3, soc: 1 };
    case "support":
      return { pow: 2, spe: 3, men: 4, soc: 4 };
    case "specialist":
      return { pow: 4, spe: 5, men: 2, soc: 1 };
    case "chaos":
      return { pow: 4, spe: 4, men: 2, soc: 4 };
    case "allround":
    default:
      return { pow: 3, spe: 3, men: 3, soc: 3 };
  }
}

function getArchetypeAxisTemplate(archetype: PlayerGeneratorArchetype | null | undefined): PlayerGeneratorResolvedAxisIntent | null {
  switch (archetype) {
    case "undead":
      return { pow: 2, spe: 2, men: 5, soc: 3 };
    case "beast":
      return { pow: 5, spe: 4, men: 1, soc: 1 };
    case "construct":
      return { pow: 3, spe: 2, men: 3, soc: 1 };
    case "angel":
      return { pow: 2, spe: 3, men: 4, soc: 5 };
    case "demon":
      return { pow: 4, spe: 3, men: 2, soc: 4 };
    case "mage":
      return { pow: 1, spe: 2, men: 5, soc: 3 };
    case "rogue":
      return { pow: 2, spe: 5, men: 3, soc: 2 };
    case "tank":
      return { pow: 5, spe: 1, men: 4, soc: 1 };
    case "warrior":
      return { pow: 5, spe: 3, men: 2, soc: 2 };
    case "social_icon":
      return { pow: 1, spe: 2, men: 3, soc: 5 };
    case "nature":
      return { pow: 2, spe: 3, men: 4, soc: 4 };
    case "pirate":
      return { pow: 3, spe: 4, men: 2, soc: 4 };
    case "ninja":
      return { pow: 2, spe: 5, men: 3, soc: 1 };
    case "mercenary":
      return { pow: 4, spe: 4, men: 3, soc: 2 };
    default:
      return null;
  }
}

function sharpenDerivedAxisIntent(
  value: number,
  input: PlayerGeneratorInput,
) {
  let nextValue = value;
  if (input.randomness === "high") {
    if (nextValue >= 4) {
      nextValue += 1;
    } else if (nextValue <= 2) {
      nextValue -= 1;
    }
  } else if (input.randomness === "low") {
    if (nextValue === 5) {
      nextValue = 4;
    } else if (nextValue === 1) {
      nextValue = 2;
    }
  }

  if ((input.strengthTier === "elite" || input.strengthTier === "legendary") && input.roleIntent !== "allround") {
    if (nextValue >= 4) {
      nextValue += 1;
    }
  }

  return clamp(Math.round(nextValue), 1, 5) as 1 | 2 | 3 | 4 | 5;
}

export function deriveAxisIntentFromProfile(input: PlayerGeneratorInput): ResolvedAxisIntentBundle {
  const roleTemplate = getRoleAxisTemplate(input.roleIntent);
  const archetypeTemplate = getArchetypeAxisTemplate(input.preferredArchetype ?? null);
  const resolvedAxisIntent = {} as PlayerGeneratorResolvedAxisIntent;
  const axisIntentSources = {} as Record<PlayerGeneratorAxisKey, PlayerGeneratorAxisSource>;
  const prefersDarkSupportSocialFloor =
    input.roleIntent === "support" && !!input.preferredArchetype && darkSupportArchetypes.has(input.preferredArchetype);

  for (const axis of ["pow", "spe", "men", "soc"] as const) {
    const userValue = normalizeAxisIntent(input.axisIntent?.[axis]);
    if (userValue != null) {
      resolvedAxisIntent[axis] = userValue;
      axisIntentSources[axis] = "user";
      continue;
    }

    const roleValue = roleTemplate[axis];
    const archetypeValue = archetypeTemplate?.[axis] ?? null;

    if (archetypeValue == null) {
      resolvedAxisIntent[axis] = sharpenDerivedAxisIntent(roleValue, input);
      axisIntentSources[axis] = "auto-role";
      continue;
    }

    if (roleValue === 3 && archetypeValue !== 3) {
      resolvedAxisIntent[axis] = sharpenDerivedAxisIntent(archetypeValue, input);
      axisIntentSources[axis] = "auto-archetype";
      continue;
    }

    if (prefersDarkSupportSocialFloor && axis === "soc" && archetypeValue < roleValue) {
      resolvedAxisIntent[axis] = sharpenDerivedAxisIntent(archetypeValue, input);
      axisIntentSources[axis] = "auto-archetype";
      continue;
    }

    if (archetypeValue === 3 && roleValue !== 3) {
      resolvedAxisIntent[axis] = sharpenDerivedAxisIntent(roleValue, input);
      axisIntentSources[axis] = "auto-role";
      continue;
    }

    resolvedAxisIntent[axis] = sharpenDerivedAxisIntent(Math.round((roleValue + archetypeValue) / 2), input);
    axisIntentSources[axis] = "blended";
  }

  return {
    resolvedAxisIntent,
    axisIntentSources,
  };
}

function getFallbacks<T extends string>(values: T[], fallbackValues: T[]) {
  return values.length ? values : fallbackValues;
}

function keywordMatch(value: string, keyword: string) {
  return toSlug(value).includes(toSlug(keyword));
}

function valueMatchesAny(value: string, candidates: string[]) {
  const normalized = toSlug(value);
  return candidates.some((candidate) => normalized.includes(toSlug(candidate)) || toSlug(candidate).includes(normalized));
}

function findPoolMatches(pool: string[], candidates: string[]) {
  return pool.filter((entry) => valueMatchesAny(entry, candidates));
}

function weightedAxisAverage(weights: Record<PlayerGeneratorAxisKey, number>, axes: Record<PlayerGeneratorAxisKey, number>) {
  return weights.pow * axes.pow + weights.spe * axes.spe + weights.men * axes.men + weights.soc * axes.soc;
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function buildGeneratedName(input: PlayerGeneratorInput, rng: () => number) {
  if (input.name?.trim()) {
    return input.name.trim();
  }
  return `${pickOne(namePrefixes, rng, "Nova")}${pickOne(nameSuffixes, rng, "or")}`;
}

function buildCatalog(players: Player[]): PlayerGeneratorCatalog {
  return {
    classes: uniqueSorted(players.map((player) => player.className)).length
      ? uniqueSorted(players.map((player) => player.className))
      : [...fallbackClasses],
    races: uniqueSorted(players.map((player) => player.race)).length
      ? uniqueSorted(players.map((player) => player.race))
      : [...fallbackRaces],
    subclasses: uniqueSorted(players.flatMap((player) => player.subclasses)).length
      ? uniqueSorted(players.flatMap((player) => player.subclasses))
      : [...fallbackSubclasses],
    positiveTraits: uniqueSorted(players.flatMap((player) => player.traitsPositive)).length
      ? uniqueSorted(players.flatMap((player) => player.traitsPositive))
      : [...fallbackPositiveTraits],
    negativeTraits: uniqueSorted(players.flatMap((player) => player.traitsNegative)).length
      ? uniqueSorted(players.flatMap((player) => player.traitsNegative))
      : [...fallbackNegativeTraits],
  };
}

function getRolePeakAttributes(input: PlayerGeneratorInput, roleProfile: PlayerGeneratorRoleProfile) {
  if (input.roleIntent === "support" && input.preferredArchetype && darkSupportArchetypes.has(input.preferredArchetype)) {
    return ["intelligence", "awareness", "will", "determination", "spirit", "torment"] satisfies PlayerGeneratorAttributeName[];
  }
  return roleProfile.peakAttributes;
}

function getRoleWeakAttributes(input: PlayerGeneratorInput, roleProfile: PlayerGeneratorRoleProfile) {
  if (input.roleIntent === "support" && input.preferredArchetype && darkSupportArchetypes.has(input.preferredArchetype)) {
    return ["power", "health", "charisma"] satisfies PlayerGeneratorAttributeName[];
  }
  return roleProfile.weakAttributes;
}

function getRandomnessJitter(mode: PlayerGeneratorRandomness, rng: () => number, bucket: keyof RandomnessProfile) {
  const range = randomnessProfiles[mode][bucket];
  return (rng() * 2 - 1) * range;
}

function buildAxisTargets(
  input: PlayerGeneratorInput,
  resolvedAxisIntent: PlayerGeneratorResolvedAxisIntent,
  roleProfile: PlayerGeneratorRoleProfile,
  archetypeConstraint: PlayerGeneratorArchetypeConstraint | null,
  rng: () => number,
) {
  const strength = strengthProfiles[input.strengthTier];
  const bias = archetypeConstraint?.axisBias;

  return {
    pow: clamp(
      strength.center +
        (resolvedAxisIntent.pow - 3) * 10 +
        roleProfile.axisBias.pow +
        (bias?.pow ?? 0) +
        getRandomnessJitter(input.randomness, rng, "axisJitter"),
      strength.min,
      strength.max,
    ),
    spe: clamp(
      strength.center +
        (resolvedAxisIntent.spe - 3) * 10 +
        roleProfile.axisBias.spe +
        (bias?.spe ?? 0) +
        getRandomnessJitter(input.randomness, rng, "axisJitter"),
      strength.min,
      strength.max,
    ),
    men: clamp(
      strength.center +
        (resolvedAxisIntent.men - 3) * 10 +
        roleProfile.axisBias.men +
        (bias?.men ?? 0) +
        getRandomnessJitter(input.randomness, rng, "axisJitter"),
      strength.min,
      strength.max,
    ),
    soc: clamp(
      strength.center +
        (resolvedAxisIntent.soc - 3) * 10 +
        roleProfile.axisBias.soc +
        (bias?.soc ?? 0) +
        getRandomnessJitter(input.randomness, rng, "axisJitter"),
      strength.min,
      strength.max,
    ),
  };
}

function applyStatSilhouette(
  input: PlayerGeneratorInput,
  attributes: PlayerGeneratorAttributes,
  roleProfile: PlayerGeneratorRoleProfile,
  archetypeConstraint: PlayerGeneratorArchetypeConstraint | null,
  rng: () => number,
) {
  const strength = strengthProfiles[input.strengthTier];
  const peakAttributes = getRolePeakAttributes(input, roleProfile);
  const weakAttributes = getRoleWeakAttributes(input, roleProfile);
  const peakBoost = input.roleIntent === "specialist" ? 13 : input.roleIntent === "chaos" ? 14 : input.roleIntent === "support" ? 9 : 10;
  const weakPenalty = input.roleIntent === "specialist" ? 12 : input.roleIntent === "chaos" ? 13 : 7;
  const shapeBoost = randomnessProfiles[input.randomness].shapeJitter;

  for (const attribute of peakAttributes) {
    attributes[attribute] = clamp(attributes[attribute] + peakBoost + Math.round(getRandomnessJitter(input.randomness, rng, "shapeJitter")), 1, strength.max);
  }
  for (const attribute of roleProfile.secondaryPeakAttributes) {
    attributes[attribute] = clamp(attributes[attribute] + Math.round(peakBoost * 0.55), 1, strength.max);
  }
  for (const attribute of weakAttributes) {
    attributes[attribute] = clamp(attributes[attribute] - weakPenalty - Math.round(shapeBoost * 0.4), 1, strength.max);
  }

  if (input.roleIntent === "chaos") {
    const chaosOrder = [...playerGeneratorAttributeKeys].sort(() => rng() - 0.5);
    chaosOrder.slice(0, 2).forEach((attribute) => {
      attributes[attribute] = clamp(attributes[attribute] + 12 + Math.round(rng() * 6), 1, strength.max);
    });
    chaosOrder.slice(-2).forEach((attribute) => {
      attributes[attribute] = clamp(attributes[attribute] - 12 - Math.round(rng() * 6), 1, strength.max);
    });
  }

  if (archetypeConstraint) {
    for (const [attribute, boost] of Object.entries(archetypeConstraint.attributeBias) as Array<[PlayerGeneratorAttributeName, number]>) {
      attributes[attribute] = clamp(attributes[attribute] + boost, 1, strength.max);
    }
  }

  if (input.randomness === "high") {
    const volatilityPeaks = peakAttributes.slice(0, 2);
    const volatilityWeaks = weakAttributes.slice(0, 2);
    volatilityPeaks.forEach((attribute) => {
      attributes[attribute] = clamp(attributes[attribute] + 4 + Math.round(rng() * 4), 1, strength.max);
    });
    volatilityWeaks.forEach((attribute) => {
      attributes[attribute] = clamp(attributes[attribute] - 4 - Math.round(rng() * 4), 1, strength.max);
    });
  }

  const getGeneratedAttributeValues = () =>
    Object.values(attributes).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const threshold = input.roleIntent === "allround" ? 12 : Math.max(roleProfile.spreadFloor, strength.spreadFloor);
  let values = getGeneratedAttributeValues();
  let spread = Math.max(...values) - Math.min(...values);

  while (spread < threshold) {
    const highestPeak = peakAttributes[0] ?? roleProfile.peakAttributes[0] ?? "power";
    const lowestWeak = weakAttributes[0] ?? roleProfile.weakAttributes[0] ?? "charisma";
    attributes[highestPeak] = clamp(attributes[highestPeak] + 3, 1, strength.max);
    attributes[lowestWeak] = clamp(attributes[lowestWeak] - 3, 1, strength.max);
    values = getGeneratedAttributeValues();
    spread = Math.max(...values) - Math.min(...values);
  }

  const center = average(values);
  const band = roleProfile.antiFlatBand;
  const flatCount = values.filter((value) => Math.abs(value - center) <= band).length;
  if (flatCount > roleProfile.antiFlatLimit) {
    peakAttributes.slice(0, 2).forEach((attribute) => {
      attributes[attribute] = clamp(attributes[attribute] + 4, 1, strength.max);
    });
    weakAttributes.slice(0, 2).forEach((attribute) => {
      attributes[attribute] = clamp(attributes[attribute] - 4, 1, strength.max);
    });
  }

  if (input.roleIntent === "allround") {
    const primary = roleProfile.peakAttributes[0] ?? "power";
    const weak = roleProfile.weakAttributes[0] ?? "torment";
    attributes[primary] = clamp(attributes[primary] + 3, 1, strength.max);
    attributes[weak] = clamp(attributes[weak] - 2, 1, strength.max);
  }

  const recenter = () => average(getGeneratedAttributeValues());
  const ensurePeaksAboveCenter = (targets: PlayerGeneratorAttributeName[], delta: number, count: number) => {
    let center = recenter();
    targets.slice(0, count).forEach((attribute) => {
      if (attributes[attribute] < center + delta) {
        attributes[attribute] = clamp(Math.round(center + delta), 1, strength.max);
        center = recenter();
      }
    });
  };
  const ensureWeaksBelowCenter = (targets: PlayerGeneratorAttributeName[], delta: number, count: number) => {
    let center = recenter();
    targets.slice(0, count).forEach((attribute) => {
      if (attributes[attribute] > center - delta) {
        attributes[attribute] = clamp(Math.round(center - delta), 1, strength.max);
        center = recenter();
      }
    });
  };

  if (input.roleIntent === "support") {
    ensurePeaksAboveCenter(getRolePeakAttributes(input, roleProfile), 6, 3);
  } else if (input.roleIntent === "specialist") {
    ensurePeaksAboveCenter(getRolePeakAttributes(input, roleProfile), 9, 3);
    ensureWeaksBelowCenter(getRoleWeakAttributes(input, roleProfile), 8, 2);
  } else if (input.roleIntent === "chaos") {
    ensurePeaksAboveCenter(getRolePeakAttributes(input, roleProfile), 10, 3);
    ensureWeaksBelowCenter(getRoleWeakAttributes(input, roleProfile), 9, 2);
  } else {
    ensurePeaksAboveCenter(getRolePeakAttributes(input, roleProfile), 5, roleProfile.minPeakCount);
  }

  values = getGeneratedAttributeValues();
  spread = Math.max(...values) - Math.min(...values);
  const minimumSpread =
    input.roleIntent === "allround"
      ? 12
      : input.roleIntent === "specialist"
        ? Math.max(26, strength.spreadFloor)
        : input.roleIntent === "chaos"
          ? Math.max(30, strength.spreadFloor)
          : Math.max(roleProfile.spreadFloor, strength.spreadFloor);
  while (spread < minimumSpread) {
    const highestPeak = peakAttributes[0] ?? roleProfile.peakAttributes[0] ?? "power";
    const lowestWeak = weakAttributes[0] ?? roleProfile.weakAttributes[0] ?? "charisma";
    attributes[highestPeak] = clamp(attributes[highestPeak] + 2, 1, strength.max);
    attributes[lowestWeak] = clamp(attributes[lowestWeak] - 2, 1, strength.max);
    values = getGeneratedAttributeValues();
    spread = Math.max(...values) - Math.min(...values);
  }
}

function buildAttributeSheetStats(
  input: PlayerGeneratorInput,
  axisTargets: Record<PlayerGeneratorAxisKey, number>,
  roleProfile: PlayerGeneratorRoleProfile,
  archetypeConstraint: PlayerGeneratorArchetypeConstraint | null,
  rng: () => number,
) {
  const strength = strengthProfiles[input.strengthTier];
  const values = {} as PlayerGeneratorAttributes;

  for (const key of playerGeneratorAttributeKeys) {
    const blended = weightedAxisAverage(attributeAxisBlend[key], axisTargets);
    values[key] = clamp(
      Math.round(blended + getRandomnessJitter(input.randomness, rng, "attributeJitter")),
      strength.min,
      strength.max,
    );
  }

  applyStatSilhouette(input, values, roleProfile, archetypeConstraint, rng);
  return values;
}

function deriveAxesFromAttributes(attributes: PlayerGeneratorAttributes) {
  return {
    pow: roundValue((attributes.power + attributes.health + attributes.stamina) / 3, 1),
    spe: roundValue((attributes.speed + attributes.dexterity + attributes.awareness) / 3, 1),
    men: roundValue((attributes.intelligence + attributes.awareness + attributes.determination + attributes.will) / 4, 1),
    soc: roundValue((attributes.charisma + attributes.spirit + attributes.torment) / 3, 1),
  };
}

function deriveDisciplineRatings(
  disciplines: Discipline[],
  attributes: PlayerGeneratorAttributes,
  warnings: string[],
) {
  const ratings: Record<string, number> = {};

  for (const discipline of disciplines) {
    const weights = officialDisciplineWeightMatrix[discipline.id as keyof typeof officialDisciplineWeightMatrix];
    if (!weights) {
      warnings.push(`Keine offizielle Diszi-Gewichtung fuer ${discipline.name}.`);
      continue;
    }

    const entries = Object.entries(weights) as Array<[PlayerGeneratorAttributeKey, number]>;
    const totalWeight = entries.reduce((sum, [, weight]) => sum + weight, 0);
    if (totalWeight <= 0) {
      warnings.push(`Leere Diszi-Gewichtung fuer ${discipline.name}.`);
      continue;
    }

    const weightedValue = entries.reduce((sum, [attributeKey, weight]) => sum + attributes[attributeKey] * weight, 0);
    ratings[discipline.id] = roundValue(clamp(weightedValue / totalWeight, 1, 99), 1);
  }

  return ratings;
}

function derivePps(disciplineRatings: Record<string, number>) {
  const ratings = Object.values(disciplineRatings).filter((value) => Number.isFinite(value));
  if (ratings.length === 0) {
    return null;
  }
  return roundValue(ratings.reduce((sum, value) => sum + value, 0) / ratings.length, 1);
}

function deriveGeneratorOvr(axes: Record<PlayerGeneratorAxisKey, number>) {
  return normalizePlayerOvr(roundValue((axes.pow + axes.spe + axes.men + axes.soc) / 4, 2));
}

function estimateDraftMarketValue(input: {
  ovr: number | null;
  pps: number | null;
  disciplineRatings: Record<string, number>;
  strengthTier: PlayerGeneratorStrengthTier;
}) {
  const topRatings = Object.values(input.disciplineRatings)
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => right - left)
    .slice(0, 3);
  const topAverage = topRatings.length ? average(topRatings) : input.pps ?? input.ovr ?? 50;
  const strengthMultiplier =
    input.strengthTier === "legendary" ? 1.34
      : input.strengthTier === "elite" ? 1.18
        : input.strengthTier === "strong" ? 1.04
          : input.strengthTier === "weak" ? 0.74
            : input.strengthTier === "very_weak" ? 0.56
              : 0.9;
  const quality = ((input.ovr ?? topAverage) * 0.45 + (input.pps ?? topAverage) * 0.25 + topAverage * 0.3) / 100;
  return roundValue(clamp(8 + quality * 52 * strengthMultiplier, 4, 90), 2);
}

function buildSalarySchedule(totalSalary: number | null, mode: NonNullable<PlayerGeneratorInput["contractMode"]>, length: number | null) {
  if (totalSalary == null || length == null || length <= 0) {
    return [];
  }
  const weights =
    mode === "front_loaded"
      ? Array.from({ length }, (_, index) => length - index)
      : mode === "back_loaded"
        ? Array.from({ length }, (_, index) => index + 1)
        : mode === "prove_it"
          ? [1]
          : Array.from({ length }, () => 1);
  const totalWeight = weights.reduce((sum, value) => sum + value, 0);
  return weights.map((weight, index) => ({
    yearIndex: index + 1,
    label: `Y${index + 1}`,
    salary: roundValue((totalSalary * weight) / totalWeight, 2),
  }));
}

function deriveProjectedRole(ovr: number | null, pps: number | null): NonNullable<PlayerGeneratorDraft["generated"]["projectedRole"]> {
  const value = ((ovr ?? 0) * 0.6) + ((pps ?? 0) * 0.4);
  if (value >= 82) return "star";
  if (value >= 68) return "starter";
  if (value >= 52) return "rotation";
  if (value >= 35) return "prospect";
  return "flier";
}

function buildCaptaincyScore(input: {
  attributes: PlayerGeneratorAttributes;
  traitsPositive: string[];
}) {
  const traitBonus = input.traitsPositive.reduce((sum, trait) => {
    const normalized = toSlug(trait);
    if (["eloquent", "leader", "motivated", "loyal", "disciplined", "team-player"].some((token) => normalized.includes(token))) {
      return sum + 7;
    }
    if (["ambitious", "famous", "clutch"].some((token) => normalized.includes(token))) {
      return sum + 3;
    }
    return sum;
  }, 0);
  return roundValue(clamp(
    input.attributes.charisma * 0.28 +
      input.attributes.spirit * 0.22 +
      input.attributes.will * 0.18 +
      input.attributes.determination * 0.16 +
      input.attributes.awareness * 0.1 +
      input.attributes.intelligence * 0.06 +
      traitBonus,
    1,
    99,
  ), 1);
}

function buildDisciplineOutlook(
  disciplines: Discipline[],
  attributes: PlayerGeneratorAttributes,
  disciplineRatings: Record<string, number>,
) {
  return disciplines
    .map((discipline) => {
      const roles = resolveSlotRolesForDiscipline(discipline.id, discipline.name, 6) as MatchdaySlotRoleDefinition[];
      const scoredSlots = roles.map((role) => {
        const profile = role.slotWeightProfile ?? role.baseWeightProfile ?? null;
        const entries = Object.entries(profile ?? {}) as Array<[PlayerGeneratorAttributeKey, number]>;
        const totalWeight = entries.reduce((sum, [, weight]) => sum + weight, 0);
        const slotScore =
          totalWeight > 0
            ? entries.reduce((sum, [attribute, weight]) => sum + attributes[attribute] * weight, 0) / totalWeight
            : disciplineRatings[discipline.id] ?? null;
        return {
          role,
          score: slotScore == null ? null : roundValue(slotScore, 1),
        };
      }).sort((left, right) => (right.score ?? Number.NEGATIVE_INFINITY) - (left.score ?? Number.NEGATIVE_INFINITY));
      const bestSlot = scoredSlots[0] ?? null;
      return {
        disciplineId: discipline.id,
        disciplineName: discipline.name,
        rating: disciplineRatings[discipline.id] ?? 0,
        category: discipline.category,
        bestSlotLabel: bestSlot?.role.label ?? null,
        bestSlotScore: bestSlot?.score ?? null,
        keyAttributes: (bestSlot?.role.keyAttributes ?? [])
          .slice(0, 3)
          .map((entry) => entry.attribute as PlayerGeneratorAttributeName),
      };
    })
    .sort((left, right) => right.rating - left.rating);
}

function buildTeamFit(input: {
  teamContext: PlayerGeneratorTeamContext | null | undefined;
  axes: Record<PlayerGeneratorAxisKey, number>;
  traitsPositive: string[];
  projectedRole: NonNullable<PlayerGeneratorDraft["generated"]["projectedRole"]>;
}) {
  const context = input.teamContext ?? null;
  if (!context?.team) {
    return {
      teamId: null,
      teamName: null,
      score: null,
      axisFit: null,
      gmFit: null,
      traitFit: null,
      rosterNeed: "unknown" as const,
      reasons: ["Kein Zielteam gewaehlt."],
      warnings: [] as string[],
    };
  }

  const identityWeights = deriveTeamIdentityAxisWeightMap(context.identity);
  const axisFit = roundValue(
    clamp(
      input.axes.pow * identityWeights.pow +
        input.axes.spe * identityWeights.spe +
        input.axes.men * identityWeights.men +
        input.axes.soc * identityWeights.soc,
      1,
      99,
    ),
    1,
  );
  const gm = context.generalManager;
  const gmAxisSum = gm ? gm.pow + gm.spe + gm.men + gm.soc : 0;
  const gmFit = gm && gmAxisSum > 0
    ? roundValue(clamp((input.axes.pow * gm.pow + input.axes.spe * gm.spe + input.axes.men * gm.men + input.axes.soc * gm.soc) / gmAxisSum, 1, 99), 1)
    : null;
  const normalizedTraits = input.traitsPositive.map((trait) => toSlug(trait));
  const gmTraitHits = gm?.preferredTraits.filter((trait) => normalizedTraits.some((entry) => entry.includes(toSlug(trait)) || toSlug(trait).includes(entry))).length ?? 0;
  const traitFit = gm ? roundValue(clamp(50 + gmTraitHits * 16, 35, 99), 1) : null;
  const rosterNeed: NonNullable<PlayerGeneratorDraft["generated"]["teamFit"]>["rosterNeed"] =
    context.identity?.playerOpt && context.rosterCount < context.identity.playerOpt - 1
      ? "thin"
      : context.identity?.playerOpt && context.rosterCount > context.identity.playerOpt + 1
        ? "crowded"
        : context.identity
          ? "healthy"
          : "unknown";
  const rosterModifier = rosterNeed === "thin" ? 8 : rosterNeed === "crowded" ? -8 : 0;
  const roleModifier =
    input.projectedRole === "star" && gm?.bias.starPriority != null
      ? (gm.bias.starPriority - 5) * 1.2
      : input.projectedRole === "rotation" && gm?.bias.rosterDepthPreference != null
        ? (gm.bias.rosterDepthPreference - 5)
        : 0;
  const score = roundValue(clamp(axisFit * 0.52 + (gmFit ?? axisFit) * 0.28 + (traitFit ?? 55) * 0.2 + rosterModifier + roleModifier, 1, 99), 1);
  const reasons = [
    `Identity-Achse passt mit ${axisFit}.`,
    gm ? `${gm.title}: ${gm.marketDoctrine}` : "Kein GM-Profil aktiv.",
    rosterNeed === "thin" ? "Kader braucht Tiefe." : rosterNeed === "crowded" ? "Kader ist eher voll." : "Kadergroesse wirkt stabil.",
  ];
  const warnings = [
    ...(score < 50 ? ["Teamfit ist schwach, eher Markt-/Trade-Kandidat als Zielspieler."] : []),
    ...(rosterNeed === "crowded" ? ["Roster ist voll: Draft waere nur sinnvoll, wenn jemand geht."] : []),
  ];

  return {
    teamId: context.team.teamId,
    teamName: context.team.name,
    score,
    axisFit,
    gmFit,
    traitFit,
    rosterNeed,
    reasons,
    warnings,
  };
}

function buildEconomyProjection(input: {
  generatorInput: PlayerGeneratorInput;
  marketValueEstimate: number | null;
  salaryFromFormula: number | null;
  ovr: number | null;
  pps: number | null;
  teamContext: PlayerGeneratorTeamContext | null | undefined;
  projectedRole: NonNullable<PlayerGeneratorDraft["generated"]["projectedRole"]>;
}) {
  const mode = input.generatorInput.contractMode ?? "balanced";
  const marketValueEstimate = input.marketValueEstimate;
  const fallbackSalary =
    marketValueEstimate == null
      ? null
      : roundValue(
          marketValueEstimate *
            (input.projectedRole === "star" ? 0.24 : input.projectedRole === "starter" ? 0.2 : input.projectedRole === "rotation" ? 0.16 : 0.12),
          2,
        );
  const salaryEstimate = input.salaryFromFormula ?? fallbackSalary;
  const valueRatio =
    marketValueEstimate != null && salaryEstimate != null && salaryEstimate > 0
      ? roundValue(marketValueEstimate / salaryEstimate, 2)
      : null;
  const averageSalary = input.teamContext?.averageSalary ?? null;
  const salaryPressure: NonNullable<PlayerGeneratorDraft["generated"]["economyProjection"]>["salaryPressure"] =
    salaryEstimate == null || averageSalary == null || averageSalary <= 0
      ? "unknown"
      : salaryEstimate > averageSalary * 1.25
        ? "high"
        : salaryEstimate > averageSalary * 0.88
          ? "medium"
          : "low";
  const recommendedContractLength =
    mode === "prove_it"
      ? 1
      : input.projectedRole === "star"
        ? 5
        : input.projectedRole === "starter"
          ? mode === "back_loaded" ? 4 : 3
          : input.projectedRole === "rotation"
            ? 2
            : 1;
  const warnings = [
    ...(salaryPressure === "high" ? ["Gehalt liegt klar ueber dem Team-Schnitt."] : []),
    ...(mode === "front_loaded" ? ["Front-loaded entlastet spaetere Seasons, kostet aber jetzt Cashdruck."] : []),
    ...(mode === "back_loaded" ? ["Back-loaded schont jetzt Cash, kann spaeter teuer werden."] : []),
  ];

  return {
    marketValueEstimate,
    salaryEstimate,
    valueRatio,
    salaryPressure,
    contractMode: mode,
    recommendedContractLength,
    salarySchedule: buildSalarySchedule(salaryEstimate, mode, recommendedContractLength),
    warnings,
  };
}

function deriveGeneratedEconomy(input: {
  attributes: PlayerGeneratorAttributes;
  traitsPositive: string[];
  traitsNegative: string[];
}): Pick<PlayerGeneratorDraft["generated"], "marketValue" | "salary" | "marketValueStatus" | "salaryStatus" | "formulaStatus"> {
  const formulaStatus = buildFormulaStatusSnapshot();
  const marketValue =
    formulaStatus.marketValueEngineStatus === "ready"
      ? null
      : null;
  const marketValueStatus = marketValue != null ? "ready" : "missing_market_value_engine";

  const canCalculateSalary =
    formulaStatus.attributeSalaryModifiersStatus === "ready" &&
    formulaStatus.traitSalaryFactorsStatus === "ready";

  if (!canCalculateSalary) {
    return {
      marketValue,
      salary: null,
      marketValueStatus,
      salaryStatus: "missing_salary_engine" as const,
      formulaStatus,
    };
  }

  if (marketValue == null) {
    return {
      marketValue,
      salary: null,
      marketValueStatus,
      salaryStatus: "missing_market_value_input" as const,
      formulaStatus,
    };
  }

  const salaryBreakdown = calculateSalaryFromMarketValue({
    salaryMarketValue: marketValue,
    attributes: input.attributes,
    traitsPositive: input.traitsPositive,
    traitsNegative: input.traitsNegative,
    attributeSalaryModifiers: playerFormulaSources.attributeSalaryModifiers!,
    traitSalaryFactors: playerFormulaSources.traitSalaryFactors!,
  });

  return {
    marketValue,
    salary: salaryBreakdown.finalSalary,
    marketValueStatus,
    salaryStatus: "ready" as const,
    formulaStatus: {
      ...formulaStatus,
      warnings: [...formulaStatus.warnings, ...salaryBreakdown.warnings],
    },
  };
}

function scoreClassFit(className: string, axes: Record<PlayerGeneratorAxisKey, number>) {
  const profile = classAxisProfiles.find((entry) => entry.keywords.some((keyword) => keywordMatch(className, keyword)));
  return roundValue(profile?.weight(axes) ?? (deriveGeneratorOvr(axes) ?? 50), 1);
}

function buildClassSuggestion(
  catalog: PlayerGeneratorCatalog,
  input: PlayerGeneratorInput,
  axes: Record<PlayerGeneratorAxisKey, number>,
  roleProfile: PlayerGeneratorRoleProfile,
  archetypeConstraint: PlayerGeneratorArchetypeConstraint | null,
) {
  const reasons: string[] = [];
  const warnings: string[] = [];
  const pool = getFallbacks(catalog.classes, fallbackClasses);

  const preferredRoleClasses = roleProfile.preferredClasses;
  const preferredArchetypeClasses = archetypeConstraint?.preferredClasses ?? [];
  const disallowedClasses = archetypeConstraint?.disallowedClasses ?? [];

  const scored = pool
    .map((className) => {
      let score = scoreClassFit(className, axes);
      if (valueMatchesAny(className, preferredArchetypeClasses)) {
        score += 18;
      }
      if (valueMatchesAny(className, preferredRoleClasses)) {
        score += 12;
      }
      if (valueMatchesAny(className, disallowedClasses)) {
        score -= 50;
      }
      return { className, score };
    })
    .sort((left, right) => right.score - left.score);

  let className = input.classHint?.trim() || scored[0]?.className || "Warlord";
  if (input.classHint?.trim()) {
    const hinted = input.classHint.trim();
    const preferred = valueMatchesAny(hinted, [...preferredRoleClasses, ...preferredArchetypeClasses]);
    const disallowed = valueMatchesAny(hinted, disallowedClasses);
    if (!preferred) {
      warnings.push(`Klassen-Override "${hinted}" weicht sichtbar vom Rollen- oder Archetyp-Profil ab.`);
    }
    if (disallowed) {
      warnings.push(`Klassen-Override "${hinted}" widerspricht dem gesetzten Archetyp.`);
    }
    className = hinted;
  }

  const fitScore = scored.find((entry) => entry.className === className)?.score ?? scoreClassFit(className, axes);
  reasons.push(`Rolle ${roleProfile.label} gewichtet ${roleProfile.peakAttributes.slice(0, 2).join(" + ")} sichtbar hoeher.`);
  if (preferredArchetypeClasses.length > 0) {
    reasons.push(`Archetyp bevorzugt Klassen wie ${preferredArchetypeClasses.slice(0, 3).join(", ")}.`);
  }
  if (axes.men >= 70) {
    reasons.push("Hohe MEN-Werte stuetzen strategische, magische oder kontrollierende Klassen.");
  }
  if (axes.spe >= 70) {
    reasons.push("Hohe SPE-Werte stuetzen mobile, duellstarke oder stealth-lastige Klassen.");
  }
  if (axes.pow >= 70) {
    reasons.push("Hohe POW-Werte sprechen fuer frontlastige oder physische Klassen.");
  }
  if (axes.soc >= 70) {
    reasons.push("Hohe SOC-Werte sprechen fuer Support-, Leadership- oder Manipulationsrollen.");
  }

  return {
    className,
    fitScore: roundValue(fitScore, 1),
    reasons,
    warnings,
  } satisfies PlayerGeneratorClassSuggestion;
}

function pickRace(
  catalog: PlayerGeneratorCatalog,
  input: PlayerGeneratorInput,
  archetypeConstraint: PlayerGeneratorArchetypeConstraint | null,
  rng: () => number,
) {
  if (input.raceHint?.trim()) {
    return input.raceHint.trim();
  }

  const racePool = getFallbacks(catalog.races, fallbackRaces);
  if (!archetypeConstraint) {
    return pickOne(racePool, rng, "Human");
  }

  const preferred = findPoolMatches(racePool, archetypeConstraint.preferredRaces);
  const allowed = findPoolMatches(racePool, archetypeConstraint.allowedRaces);
  const filteredAllowed = allowed.filter((entry) => !valueMatchesAny(entry, archetypeConstraint.disallowedRaces));
  const fallback = racePool.filter((entry) => !valueMatchesAny(entry, archetypeConstraint.disallowedRaces));

  return pickOne(preferred.length ? preferred : filteredAllowed.length ? filteredAllowed : fallback, rng, fallback[0] ?? "Human");
}

function pickSubclasses(
  catalog: PlayerGeneratorCatalog,
  input: PlayerGeneratorInput,
  className: string,
  roleProfile: PlayerGeneratorRoleProfile,
  archetypeConstraint: PlayerGeneratorArchetypeConstraint | null,
  rng: () => number,
) {
  const pool = getFallbacks(catalog.subclasses, fallbackSubclasses);
  const preferredArchetype = archetypeConstraint ? findPoolMatches(pool, archetypeConstraint.preferredSubclasses) : [];
  const preferredRole = findPoolMatches(pool, roleProfile.preferredSubclasses);
  const classMatches = pool.filter((entry) => keywordMatch(entry, className) || keywordMatch(className, entry));
  const primary = pickOne(
    preferredArchetype.length ? preferredArchetype : preferredRole.length ? preferredRole : classMatches.length ? classMatches : pool,
    rng,
    "Warrior",
  );
  const secondaryPool = preferredRole.filter((entry) => entry !== primary).length
    ? preferredRole.filter((entry) => entry !== primary)
    : preferredArchetype.filter((entry) => entry !== primary).length
      ? preferredArchetype.filter((entry) => entry !== primary)
      : classMatches.filter((entry) => entry !== primary).length
        ? classMatches.filter((entry) => entry !== primary)
        : pool.filter((entry) => entry !== primary);
  const secondary = pickOne(secondaryPool, rng, primary);
  return uniqueSorted([primary, secondary]).slice(0, 2);
}

function pickTraits(
  catalog: PlayerGeneratorCatalog,
  input: PlayerGeneratorInput,
  roleProfile: PlayerGeneratorRoleProfile,
  archetypeConstraint: PlayerGeneratorArchetypeConstraint | null,
  rng: () => number,
) {
  const positivePool = getFallbacks(catalog.positiveTraits, fallbackPositiveTraits);
  const negativePool = getFallbacks(catalog.negativeTraits, fallbackNegativeTraits);
  const preferredPositive = archetypeConstraint ? findPoolMatches(positivePool, archetypeConstraint.preferredPositiveTraits) : [];
  const preferredNegative = archetypeConstraint ? findPoolMatches(negativePool, archetypeConstraint.preferredNegativeTraits) : [];
  const hint = input.traitHint?.trim();

  const positiveBase = uniqueSorted([
    hint
      ? positivePool.find((entry) => keywordMatch(entry, hint)) ?? hint
      : pickOne(preferredPositive.length ? preferredPositive : positivePool, rng, "Motivated"),
    pickOne(
      positivePool.filter((entry) => entry !== hint && !preferredPositive.includes(entry)).concat(preferredPositive),
      rng,
      "Disciplined",
    ),
  ]).slice(0, 2);

  const negativeBase = uniqueSorted([
    pickOne(preferredNegative.length ? preferredNegative : negativePool, rng, "Obsessive"),
  ]).slice(0, 1);

  if (input.roleIntent === "support" && !positiveBase.some((entry) => ["caring", "altruistic", "loyal", "eloquent"].some((token) => keywordMatch(entry, token)))) {
    const supportTrait = positivePool.find((entry) => ["caring", "altruistic", "loyal", "eloquent"].some((token) => keywordMatch(entry, token)));
    if (supportTrait) {
      positiveBase[0] = supportTrait;
    }
  }

  if (input.preferredArchetype === "mercenary" && negativePool.some((entry) => keywordMatch(entry, "mercenary"))) {
    negativeBase[0] = negativePool.find((entry) => keywordMatch(entry, "mercenary")) ?? negativeBase[0];
  }

  return {
    traitsPositive: uniqueSorted(positiveBase),
    traitsNegative: uniqueSorted(negativeBase),
  };
}

function sortAttributeEntries(attributes: PlayerGeneratorAttributes) {
  return (Object.entries(attributes) as Array<[keyof PlayerGeneratorAttributes, number | null | undefined]>)
    .filter((entry): entry is [PlayerGeneratorAttributeName, number] => entry[0] !== "height" && typeof entry[1] === "number" && Number.isFinite(entry[1]))
    .sort((left, right) => right[1] - left[1]);
}

function buildArchetypeValidation(
  input: PlayerGeneratorInput,
  generated: PlayerGeneratorDraft["generated"],
  archetypeConstraint: PlayerGeneratorArchetypeConstraint | null,
) {
  if (!input.preferredArchetype || !archetypeConstraint) {
    return {
      state: "ok" as PlayerGeneratorMatchState,
      warnings: [] as string[],
      summary: ["Kein harter Archetyp gesetzt."],
    };
  }

  const identityPool = [
    generated.race,
    generated.className,
    ...generated.subclasses,
    ...generated.traitsPositive,
    ...generated.traitsNegative,
  ];
  const identityHit = identityPool.some((entry) => valueMatchesAny(entry, archetypeConstraint.identityKeywords));
  const preferredSubclassHit = generated.subclasses.some((entry) => valueMatchesAny(entry, archetypeConstraint.preferredSubclasses));
  const disallowedRace = valueMatchesAny(generated.race, archetypeConstraint.disallowedRaces);
  const disallowedClass = valueMatchesAny(generated.className, archetypeConstraint.disallowedClasses);
  const preferredRaceHit = valueMatchesAny(generated.race, [...archetypeConstraint.preferredRaces, ...archetypeConstraint.allowedRaces]);
  const warnings: string[] = [];
  const summary = [`Archetyp ${archetypeConstraint.label}: ${generated.race} / ${generated.className} / ${generated.subclasses.join(", ") || "—"}`];

  if (disallowedRace || disallowedClass) {
    warnings.push(`Archetyp-Konflikt: ${generated.race} / ${generated.className} widerspricht ${archetypeConstraint.label}.`);
    return { state: "failed" as PlayerGeneratorMatchState, warnings, summary };
  }

  if (archetypeConstraint.validationRules.requireIdentityHit && !identityHit) {
    warnings.push(`Archetyp ${archetypeConstraint.label} wurde nicht klar in Race, Klasse, Subclasses oder Traits getroffen.`);
    return { state: "failed" as PlayerGeneratorMatchState, warnings, summary };
  }

  if (archetypeConstraint.validationRules.requirePreferredSubclass && !preferredSubclassHit) {
    warnings.push(`Archetyp ${archetypeConstraint.label} hat keine harte Subclass-Signatur wie ${archetypeConstraint.preferredSubclasses.slice(0, 3).join(", ")}.`);
    return { state: "failed" as PlayerGeneratorMatchState, warnings, summary };
  }

  if (!preferredRaceHit && !preferredSubclassHit) {
    warnings.push(`Archetyp ${archetypeConstraint.label} sitzt noch weich und kann manuell nachgeschaerft werden.`);
    return { state: "warning" as PlayerGeneratorMatchState, warnings, summary };
  }

  return { state: "ok" as PlayerGeneratorMatchState, warnings, summary };
}

function buildRoleValidation(
  input: PlayerGeneratorInput,
  generated: PlayerGeneratorDraft["generated"],
  roleProfile: PlayerGeneratorRoleProfile,
) {
  const entries = Object.values(generated.attributes).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const center = average(entries);
  const peaks = getRolePeakAttributes(input, roleProfile);
  const weaknesses = getRoleWeakAttributes(input, roleProfile);
  const peakCount = peaks.filter((attribute) => generated.attributes[attribute] >= center + 6).length;
  const weakCount = weaknesses.filter((attribute) => generated.attributes[attribute] <= center - 5).length;
  const spread = Math.max(...entries) - Math.min(...entries);
  const warnings: string[] = [];
  const summary = [...roleProfile.roleSummary];

  if (input.roleIntent === "support" && input.preferredArchetype && darkSupportArchetypes.has(input.preferredArchetype)) {
    summary.push("Dark-Support akzeptiert mittleren Spirit-Wert, wenn Will, Awareness und Intelligence klar tragen.");
  }

  if (input.roleIntent === "support") {
    if (peakCount >= 3) {
      return { state: "ok" as PlayerGeneratorMatchState, warnings, summary };
    }
    if (peakCount === 2) {
      warnings.push("Support-Profil ist vorhanden, aber noch nicht stark genug ausgepraegt.");
      return { state: "warning" as PlayerGeneratorMatchState, warnings, summary };
    }
    warnings.push("Support-Profil verfehlt die geforderten hohen Support-Werte.");
    return { state: "failed" as PlayerGeneratorMatchState, warnings, summary };
  }

  if (input.roleIntent === "allround") {
    if (spread < 12) {
      warnings.push("Allround-Profil ist zu glatt und wirkt wie Einheitsbrei.");
      return { state: "failed" as PlayerGeneratorMatchState, warnings, summary };
    }
    if (peakCount < 1 || weakCount < 1) {
      warnings.push("Allround-Profil braucht mindestens eine erkennbare Staerke und eine erkennbare Schwaeche.");
      return { state: "warning" as PlayerGeneratorMatchState, warnings, summary };
    }
    return { state: "ok" as PlayerGeneratorMatchState, warnings, summary };
  }

  if (input.roleIntent === "specialist") {
    if (spread >= 26 && peakCount >= 2 && weakCount >= 2) {
      return { state: "ok" as PlayerGeneratorMatchState, warnings, summary };
    }
    warnings.push("Specialist braucht sichtbar mehr Peaks und klare Schwaechen.");
    return { state: spread >= 22 ? "warning" as PlayerGeneratorMatchState : "failed" as PlayerGeneratorMatchState, warnings, summary };
  }

  if (input.roleIntent === "chaos") {
    if (spread >= 30 && peakCount >= 2 && weakCount >= 2) {
      return { state: "ok" as PlayerGeneratorMatchState, warnings, summary };
    }
    warnings.push("Chaos braucht extremeren Spread zwischen Spitzen und Totalausfaellen.");
    return { state: spread >= 24 ? "warning" as PlayerGeneratorMatchState : "failed" as PlayerGeneratorMatchState, warnings, summary };
  }

  if (peakCount >= roleProfile.minPeakCount) {
    return { state: "ok" as PlayerGeneratorMatchState, warnings, summary };
  }

  warnings.push(`${roleProfile.label}-Profil braucht klarere Peak-Attribute.`);
  return { state: "warning" as PlayerGeneratorMatchState, warnings, summary };
}

function countFlatAttributes(attributes: PlayerGeneratorAttributes, band: number) {
  const values = Object.values(attributes).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const center = average(values);
  return values.filter((value) => Math.abs(value - center) <= band).length;
}

function validateGeneratedPlayerDraft(input: {
  generatorInput: PlayerGeneratorInput;
  generated: PlayerGeneratorDraft["generated"];
  catalog: PlayerGeneratorCatalog;
  roleProfile: PlayerGeneratorRoleProfile;
  archetypeConstraint: PlayerGeneratorArchetypeConstraint | null;
  disciplineWarnings: string[];
  resolvedAxisIntent: PlayerGeneratorResolvedAxisIntent;
  axisIntentSources: Record<PlayerGeneratorAxisKey, PlayerGeneratorAxisSource>;
}) {
  const { generatorInput, generated, catalog, roleProfile, archetypeConstraint, disciplineWarnings, resolvedAxisIntent, axisIntentSources } = input;
  const warnings = [...disciplineWarnings];
  const qualityWarnings: ValidationDiagnostics["qualityWarnings"] = [];
  const engineStatus: ValidationDiagnostics["engineStatus"] = {
    marketValueEngine:
      generated.marketValueStatus === "ready"
        ? "ready"
        : playerFormulaSources.rankMarketValueStatus === "incomplete_source"
          ? "incomplete_source"
          : "blocked",
    salaryEngine:
      generated.salaryStatus === "ready"
        ? "ready"
        : generated.salaryStatus === "missing_market_value_input"
          ? "missing_market_value_input"
          : "blocked",
    classEngine:
      playerFormulaSources.classEngineStatus === "ready"
        ? "ready"
        : playerFormulaSources.classEngineStatus === "heuristic"
          ? "heuristic"
          : "blocked",
    potentialEngine: "missing_progression_source",
  };
  const draftStatus: ValidationDiagnostics["draftStatus"] = {
    ovr: "draft_preview",
    pps: "draft_preview",
  };
  const saveStatus: ValidationDiagnostics["saveStatus"] = {
    save: "draft_only",
    commit: "disabled",
    commitReasons: [],
  };

  if (playerFormulaSources.attributeSalaryModifiersStatus !== "ready") {
    pushUnique(
      warnings,
      describeSourceWarning(playerFormulaSources.attributeSalaryModifiersStatus, "attribute_salary_modifiers"),
    );
  }
  if (playerFormulaSources.traitSalaryFactorsStatus !== "ready") {
    pushUnique(
      warnings,
      describeSourceWarning(playerFormulaSources.traitSalaryFactorsStatus, "trait_salary_factors"),
    );
  }
  if (generated.salaryStatus === "missing_market_value_input") {
    pushUnique(warnings, "salary_engine_waits_for_market_value_input");
    pushUnique(saveStatus.commitReasons, "salary_engine_waits_for_market_value");
  } else if (generated.salaryStatus === "missing_salary_engine") {
    pushUnique(warnings, "salary_engine_source_missing");
    pushUnique(saveStatus.commitReasons, "salary_engine_blocked");
  }
  if (generated.marketValueStatus !== "ready") {
    pushUnique(saveStatus.commitReasons, "market_value_engine_blocked");
  }
  pushUnique(saveStatus.commitReasons, "commit_path_not_ready");

  const archetypeValidation = buildArchetypeValidation(generatorInput, generated, archetypeConstraint);
  const roleValidation = buildRoleValidation(generatorInput, generated, roleProfile);
  const entries = sortAttributeEntries(generated.attributes);
  const statSpread = entries[0][1] - entries[entries.length - 1][1];
  const flatAttributeCount = countFlatAttributes(generated.attributes, roleProfile.antiFlatBand);

  warnings.push(...generated.classSuggestion.warnings);
  warnings.push(...generated.formulaStatus.warnings);
  warnings.push(...archetypeValidation.warnings);
  warnings.push(...roleValidation.warnings);

  if (disciplineWarnings.length > 0) {
    pushUnique(warnings, "discipline_weight_source_missing");
  }

  const autoAxisCount = Object.values(axisIntentSources).filter((source) => source !== "user").length;
  if (autoAxisCount > 0) {
    pushUnique(warnings, "axis_auto_resolved");
    pushUnique(qualityWarnings, "axis_auto_resolved");
  }

  if (flatAttributeCount > roleProfile.antiFlatLimit) {
    pushUnique(warnings, "too_flat_profile");
    pushUnique(qualityWarnings, "too_flat_profile");
  }

  const strength = strengthProfiles[generatorInput.strengthTier];
  const ovr = generated.ovr ?? deriveGeneratorOvr(generated.axes) ?? null;
  if (ovr != null && (ovr < strength.min - 4 || ovr > strength.max + 4)) {
    pushUnique(warnings, `strength_tier_borderline:${generatorInput.strengthTier}`);
  }

  const knownRaces = new Set(getFallbacks(catalog.races, fallbackRaces).map((entry) => entry.toLowerCase()));
  const knownClasses = new Set(getFallbacks(catalog.classes, fallbackClasses).map((entry) => entry.toLowerCase()));
  const knownTraits = new Set(
    [...getFallbacks(catalog.positiveTraits, fallbackPositiveTraits), ...getFallbacks(catalog.negativeTraits, fallbackNegativeTraits)].map((entry) =>
      entry.toLowerCase(),
    ),
  );
  if (generatorInput.raceHint?.trim() && !knownRaces.has(generatorInput.raceHint.trim().toLowerCase())) {
    pushUnique(qualityWarnings, "unknown_race");
  }
  if (generatorInput.classHint?.trim() && !knownClasses.has(generatorInput.classHint.trim().toLowerCase())) {
    pushUnique(qualityWarnings, "unknown_class");
  }
  if (generatorInput.traitHint?.trim() && !knownTraits.has(generatorInput.traitHint.trim().toLowerCase())) {
    pushUnique(qualityWarnings, "unknown_trait");
  }
  if (archetypeConstraint) {
    const hasRacePool = findPoolMatches(getFallbacks(catalog.races, fallbackRaces), [...archetypeConstraint.preferredRaces, ...archetypeConstraint.allowedRaces]).length > 0;
    const hasSubclassPool = findPoolMatches(getFallbacks(catalog.subclasses, fallbackSubclasses), archetypeConstraint.preferredSubclasses).length > 0;
    if (!hasRacePool && !hasSubclassPool) {
      pushUnique(qualityWarnings, "archetype_pool_missing");
    }
  }
  if (archetypeValidation.state === "failed") {
    pushUnique(qualityWarnings, "archetype_constraint_failed");
  }
  if (roleValidation.state !== "ok") {
    pushUnique(qualityWarnings, "role_profile_weak");
  }
  if (generated.classSuggestion.warnings.some((warning) => warning.includes("widerspricht"))) {
    pushUnique(qualityWarnings, "archetype_constraint_failed");
  }
  if (generated.classSuggestion.warnings.some((warning) => warning.includes("Rollen- oder Archetyp-Profil"))) {
    pushUnique(qualityWarnings, "role_profile_weak");
  }

  let validationStatus: PlayerGeneratorValidationStatus = "ready_for_review";
  if (archetypeValidation.state === "failed") {
    validationStatus =
      warnings.some((warning) => warning.includes("widerspricht")) || Boolean(generatorInput.raceHint?.trim()) || Boolean(generatorInput.classHint?.trim())
        ? "blocked_archetype_conflict"
        : "needs_edit";
  } else if (roleValidation.state === "failed" || flatAttributeCount > roleProfile.antiFlatLimit || Object.keys(generated.disciplineRatings).length === 0) {
    validationStatus = "needs_edit";
  } else if (archetypeValidation.state === "warning" || roleValidation.state === "warning") {
    validationStatus = "needs_edit";
  }

  const diagnostics: ValidationDiagnostics = {
    archetypeMatch: archetypeValidation.state,
    roleMatch: roleValidation.state,
    statSilhouette:
      flatAttributeCount > roleProfile.antiFlatLimit
        ? "failed"
        : roleValidation.state === "failed"
          ? "failed"
          : roleValidation.state === "warning"
            ? "warning"
        : "ok",
    engineStatus,
    draftStatus,
    saveStatus,
    qualityWarnings,
    statSpread,
    flatAttributeCount,
    resolvedAxisIntent,
    axisIntentSources,
    peakAttributes: entries.slice(0, 3).map(([attribute]) => attribute),
    weakAttributes: entries.slice(-3).map(([attribute]) => attribute),
      archetypeSummary: archetypeValidation.summary,
      roleSummary: roleValidation.summary,
  };

  const qualityScore =
    100 -
    warnings.length * 4 -
    qualityWarnings.length * 2 -
    (validationStatus === "blocked_archetype_conflict" ? 40 : validationStatus === "needs_edit" ? 18 : 0) -
    (archetypeValidation.state === "failed" ? 15 : archetypeValidation.state === "warning" ? 6 : 0) -
    (roleValidation.state === "failed" ? 15 : roleValidation.state === "warning" ? 6 : 0) -
    Math.max(0, flatAttributeCount - roleProfile.antiFlatLimit) * 2;

  return {
    warnings: uniqueSorted(warnings),
    diagnostics,
    validationStatus,
    qualityScore,
  } satisfies ValidationResult;
}

function buildDraftId(seed: string) {
  return `player-draft-${toSlug(seed)}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildCandidate(input: {
  generatorInput: PlayerGeneratorInput;
  players: Player[];
  disciplines: Discipline[];
  seedVariant: string;
  teamContext?: PlayerGeneratorTeamContext | null;
}) {
  const generatorInput = input.generatorInput;
  const rng = createSeededRng(input.seedVariant);
  const catalog = buildCatalog(input.players);
  const roleProfile = playerGeneratorRoleProfiles[generatorInput.roleIntent];
  const archetypeConstraint = generatorInput.preferredArchetype ? playerGeneratorArchetypes[generatorInput.preferredArchetype] : null;
  const axisResolution = deriveAxisIntentFromProfile(generatorInput);
  const axisTargets = buildAxisTargets(generatorInput, axisResolution.resolvedAxisIntent, roleProfile, archetypeConstraint, rng);
  const attributes = buildAttributeSheetStats(generatorInput, axisTargets, roleProfile, archetypeConstraint, rng);
  const axes = deriveAxesFromAttributes(attributes);
  const classSuggestion = buildClassSuggestion(catalog, generatorInput, axes, roleProfile, archetypeConstraint);
  const race = pickRace(catalog, generatorInput, archetypeConstraint, rng);
  const subclasses = pickSubclasses(catalog, generatorInput, classSuggestion.className, roleProfile, archetypeConstraint, rng);
  const traits = pickTraits(catalog, generatorInput, roleProfile, archetypeConstraint, rng);
  const disciplineWarnings: string[] = [];
  const disciplineRatings = deriveDisciplineRatings(input.disciplines, attributes, disciplineWarnings);
  const pps = derivePps(disciplineRatings);
  const ovr = deriveGeneratorOvr(axes);
  const generatedEconomy = deriveGeneratedEconomy({
    attributes,
    traitsPositive: traits.traitsPositive,
    traitsNegative: traits.traitsNegative,
  });
  const disciplineOutlook = buildDisciplineOutlook(input.disciplines, attributes, disciplineRatings);
  const marketValueEstimate = estimateDraftMarketValue({
    ovr,
    pps,
    disciplineRatings,
    strengthTier: generatorInput.strengthTier,
  });
  const projectedRole = deriveProjectedRole(ovr, pps);
  const economyProjection = buildEconomyProjection({
    generatorInput,
    marketValueEstimate,
    salaryFromFormula: generatedEconomy.salary,
    ovr,
    pps,
    teamContext: input.teamContext,
    projectedRole,
  });
  const captaincyScore = buildCaptaincyScore({
    attributes,
    traitsPositive: traits.traitsPositive,
  });
  const teamFit = buildTeamFit({
    teamContext: input.teamContext,
    axes,
    traitsPositive: traits.traitsPositive,
    projectedRole,
  });

  const generatedBase = {
    name: buildGeneratedName(generatorInput, rng),
    portraitUrl: null,
    race,
    className: classSuggestion.className,
    classSuggestion,
    subclasses,
    traitsPositive: traits.traitsPositive,
    traitsNegative: traits.traitsNegative,
    attributes,
    axes,
    disciplineRatings,
    disciplineOutlook,
    ovr,
    pps,
    potential: null,
    projectedRole,
    captaincyScore,
    teamFit,
    economyProjection,
    marketValue: economyProjection.marketValueEstimate,
    salary: economyProjection.salaryEstimate,
    marketValueStatus: economyProjection.marketValueEstimate != null ? "ready" : generatedEconomy.marketValueStatus,
    salaryStatus: economyProjection.salaryEstimate != null ? "ready" : generatedEconomy.salaryStatus,
    formulaStatus: generatedEconomy.formulaStatus,
    diagnostics: {
      archetypeMatch: "warning" as PlayerGeneratorMatchState,
      roleMatch: "warning" as PlayerGeneratorMatchState,
      statSilhouette: "warning" as PlayerGeneratorMatchState,
      statSpread: 0,
      flatAttributeCount: 0,
      engineStatus: {
        marketValueEngine: "blocked",
        salaryEngine: "blocked",
        classEngine: "heuristic",
        potentialEngine: "missing_progression_source",
      },
      draftStatus: {
        ovr: "draft_preview",
        pps: "draft_preview",
      },
      saveStatus: {
        save: "draft_only",
        commit: "disabled",
        commitReasons: ["market_value_engine_blocked", "commit_path_not_ready"],
      },
      qualityWarnings: [],
      resolvedAxisIntent: axisResolution.resolvedAxisIntent,
      axisIntentSources: axisResolution.axisIntentSources,
      peakAttributes: [],
      weakAttributes: [],
      archetypeSummary: [],
      roleSummary: [],
    },
  } satisfies PlayerGeneratorDraft["generated"];

  const validation = validateGeneratedPlayerDraft({
    generatorInput,
    generated: generatedBase,
    catalog,
    roleProfile,
    archetypeConstraint,
    disciplineWarnings,
    resolvedAxisIntent: axisResolution.resolvedAxisIntent,
    axisIntentSources: axisResolution.axisIntentSources,
  });

  return {
    generated: {
      ...generatedBase,
      diagnostics: validation.diagnostics,
    },
    warnings: validation.warnings,
    validationStatus: validation.validationStatus,
    qualityScore: validation.qualityScore,
  };
}

function selectBestCandidate(input: {
  generatorInput: PlayerGeneratorInput;
  players: Player[];
  disciplines: Discipline[];
  strictMode?: boolean;
  teamContext?: PlayerGeneratorTeamContext | null;
}) {
  const seed = input.generatorInput.seed?.trim() || `draft-${Date.now()}`;
  const attempts = input.strictMode ? 10 : 6;
  let best = buildCandidate({
    generatorInput: input.generatorInput,
    players: input.players,
    disciplines: input.disciplines,
    seedVariant: `${seed}::pass-0`,
    teamContext: input.teamContext,
  });

  for (let index = 1; index < attempts; index += 1) {
    const candidate = buildCandidate({
      generatorInput: input.generatorInput,
      players: input.players,
      disciplines: input.disciplines,
      seedVariant: `${seed}::pass-${index}`,
      teamContext: input.teamContext,
    });
    if (candidate.qualityScore > best.qualityScore) {
      best = candidate;
    }
    if (candidate.validationStatus === "ready_for_review" && candidate.generated.diagnostics.archetypeMatch === "ok" && candidate.generated.diagnostics.roleMatch === "ok") {
      best = candidate;
      break;
    }
  }

  return best;
}

export function createDefaultPlayerGeneratorInput(): PlayerGeneratorInput {
  return structuredClone(defaultInput);
}

export function buildPlayerGeneratorCatalog(players: Player[]) {
  return buildCatalog(players);
}

export function generatePlayerDraft(input: {
  generatorInput: PlayerGeneratorInput;
  players: Player[];
  disciplines: Discipline[];
  teamContext?: PlayerGeneratorTeamContext | null;
  draftId?: string;
  createdAt?: string;
}): PlayerGeneratorDraft {
  const generatorInput = {
    ...createDefaultPlayerGeneratorInput(),
    ...input.generatorInput,
    axisIntent: {
      ...createDefaultPlayerGeneratorInput().axisIntent,
      ...input.generatorInput.axisIntent,
    },
  } satisfies PlayerGeneratorInput;
  const normalizedSeed = generatorInput.seed?.trim() || `draft-${Date.now()}`;
  const best = selectBestCandidate({
    generatorInput: {
      ...generatorInput,
      seed: normalizedSeed,
    },
    players: input.players,
    disciplines: input.disciplines,
    teamContext: input.teamContext,
  });

  return {
    draftId: input.draftId ?? buildDraftId(normalizedSeed),
    input: {
      ...generatorInput,
      seed: normalizedSeed,
    },
    generated: best.generated,
    warnings: best.warnings,
    validationStatus: best.validationStatus,
    createdAt: input.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } satisfies PlayerGeneratorDraft;
}

export function tightenPlayerGeneratorDraft(input: {
  draft: PlayerGeneratorDraft;
  players: Player[];
  disciplines: Discipline[];
  teamContext?: PlayerGeneratorTeamContext | null;
}): PlayerGeneratorDraft {
  const best = selectBestCandidate({
    generatorInput: input.draft.input,
    players: input.players,
    disciplines: input.disciplines,
    strictMode: true,
    teamContext: input.teamContext,
  });

  return {
    ...input.draft,
    generated: {
      ...best.generated,
      name: input.draft.generated.name || best.generated.name,
    },
    warnings: best.warnings,
    validationStatus: best.validationStatus,
    updatedAt: new Date().toISOString(),
  } satisfies PlayerGeneratorDraft;
}

export function recalculatePlayerGeneratorDraft(input: {
  draft: PlayerGeneratorDraft;
  players: Player[];
  disciplines: Discipline[];
  teamContext?: PlayerGeneratorTeamContext | null;
}): PlayerGeneratorDraft {
  const disciplineWarnings: string[] = [];
  const attributes = input.draft.generated.attributes;
  const axes = deriveAxesFromAttributes(attributes);
  const disciplineRatings = deriveDisciplineRatings(input.disciplines, attributes, disciplineWarnings);
  const pps = derivePps(disciplineRatings);
  const ovr = deriveGeneratorOvr(axes);
  const generatedEconomy = deriveGeneratedEconomy({
    attributes,
    traitsPositive: input.draft.generated.traitsPositive,
    traitsNegative: input.draft.generated.traitsNegative,
  });
  const disciplineOutlook = buildDisciplineOutlook(input.disciplines, attributes, disciplineRatings);
  const projectedRole = deriveProjectedRole(ovr, pps);
  const economyProjection = buildEconomyProjection({
    generatorInput: input.draft.input,
    marketValueEstimate: estimateDraftMarketValue({
      ovr,
      pps,
      disciplineRatings,
      strengthTier: input.draft.input.strengthTier,
    }),
    salaryFromFormula: generatedEconomy.salary,
    ovr,
    pps,
    teamContext: input.teamContext,
    projectedRole,
  });
  const captaincyScore = buildCaptaincyScore({
    attributes,
    traitsPositive: input.draft.generated.traitsPositive,
  });
  const teamFit = buildTeamFit({
    teamContext: input.teamContext,
    axes,
    traitsPositive: input.draft.generated.traitsPositive,
    projectedRole,
  });
  const roleProfile = playerGeneratorRoleProfiles[input.draft.input.roleIntent];
  const archetypeConstraint = input.draft.input.preferredArchetype ? playerGeneratorArchetypes[input.draft.input.preferredArchetype] : null;
  const catalog = buildCatalog(input.players);
  const generated = {
    ...input.draft.generated,
    axes,
    disciplineRatings,
    disciplineOutlook,
    ovr,
    pps,
    projectedRole,
    captaincyScore,
    teamFit,
    economyProjection,
    marketValue: economyProjection.marketValueEstimate,
    salary: economyProjection.salaryEstimate,
    marketValueStatus: economyProjection.marketValueEstimate != null ? "ready" : generatedEconomy.marketValueStatus,
    salaryStatus: economyProjection.salaryEstimate != null ? "ready" : generatedEconomy.salaryStatus,
    formulaStatus: generatedEconomy.formulaStatus,
  } satisfies PlayerGeneratorDraft["generated"];
  const axisResolution = deriveAxisIntentFromProfile(input.draft.input);
  const validation = validateGeneratedPlayerDraft({
    generatorInput: input.draft.input,
    generated,
    catalog,
    roleProfile,
    archetypeConstraint,
    disciplineWarnings,
    resolvedAxisIntent: axisResolution.resolvedAxisIntent,
    axisIntentSources: axisResolution.axisIntentSources,
  });

  return {
    ...input.draft,
    generated: {
      ...generated,
      diagnostics: validation.diagnostics,
    },
    warnings: validation.warnings,
    validationStatus: validation.validationStatus,
    updatedAt: new Date().toISOString(),
  } satisfies PlayerGeneratorDraft;
}
