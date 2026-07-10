import type { Player, PlayerGeneratorAttributeName } from "@/lib/data/olyDataTypes";
import { playerGeneratorAttributeKeys } from "@/lib/player-generator/official-discipline-weights";

export const DEVELOPMENT_MAX_ATTRIBUTE_VALUE = 99;

export const TRAINING_ATTRIBUTE_LABELS: Record<PlayerGeneratorAttributeName, string> = {
  power: "Power",
  health: "Health",
  stamina: "Stamina",
  intelligence: "Intelligence",
  awareness: "Awareness",
  determination: "Determination",
  speed: "Speed",
  dexterity: "Dexterity",
  charisma: "Charisma",
  will: "Will",
  spirit: "Spirit",
  torment: "Torment",
};

export type AttributeAffinityKind = "signature" | "weak" | "neutral";

export type AttributeAffinityProfile = {
  playerId: string;
  signatureAttributes: [PlayerGeneratorAttributeName, PlayerGeneratorAttributeName];
  weakAttribute: PlayerGeneratorAttributeName;
  reasons: string[];
};

export function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function getPlayerAttributeValue(player: Player, attribute: PlayerGeneratorAttributeName): number | null {
  const value = player.attributeSheetStats?.[attribute];
  return isFiniteNumber(value) ? value : null;
}

function hasTrait(player: Player, values: string[]) {
  const tokens = [...(player.traitsPositive ?? []), ...(player.traitsNegative ?? []), player.className, player.race, ...player.subclasses].join(" ").toLowerCase();
  return values.some((value) => tokens.includes(value.toLowerCase()));
}

function pushUnique<T>(target: T[], value: T) {
  if (!target.includes(value)) target.push(value);
}

export function deriveAttributeAffinityProfile(player: Player): AttributeAffinityProfile {
  const signatureCandidates: PlayerGeneratorAttributeName[] = [];
  const weakCandidates: PlayerGeneratorAttributeName[] = [];
  const reasons: string[] = [];

  const className = player.className.toLowerCase();
  if (className.includes("mage") || hasTrait(player, ["wizard", "scholar", "oracle"])) {
    pushUnique(signatureCandidates, "intelligence");
    pushUnique(signatureCandidates, "will");
    reasons.push("mental_class_or_subclass");
  }
  if (className.includes("tank") || hasTrait(player, ["guardian", "warrior", "brute"])) {
    pushUnique(signatureCandidates, "health");
    pushUnique(signatureCandidates, "stamina");
    reasons.push("durable_role");
  }
  if (className.includes("charger") || className.includes("rogue") || hasTrait(player, ["runner", "assassin", "swift"])) {
    pushUnique(signatureCandidates, "speed");
    pushUnique(signatureCandidates, "dexterity");
    reasons.push("speed_role");
  }
  if (className.includes("hero") || className.includes("warlord") || hasTrait(player, ["leader", "loyal", "ambitious"])) {
    pushUnique(signatureCandidates, "determination");
    pushUnique(signatureCandidates, "charisma");
    reasons.push("leader_role");
  }
  if (className.includes("badass") || hasTrait(player, ["fearless", "chaos", "demon"])) {
    pushUnique(signatureCandidates, "power");
    pushUnique(signatureCandidates, "torment");
    reasons.push("high_impact_role");
  }
  if (hasTrait(player, ["diligent", "disciplined", "motivated"])) {
    pushUnique(signatureCandidates, "determination");
    pushUnique(signatureCandidates, "stamina");
    reasons.push("positive_training_traits");
  }
  if (hasTrait(player, ["diva", "lazy", "fainthearted"])) {
    pushUnique(weakCandidates, "determination");
    pushUnique(weakCandidates, "stamina");
    reasons.push("negative_training_traits");
  }
  if (hasTrait(player, ["obsessive", "paranoid"])) {
    pushUnique(weakCandidates, "spirit");
    reasons.push("volatile_trait_pressure");
  }

  const sortedAttributes = [...playerGeneratorAttributeKeys]
    .map((attribute) => ({ attribute: attribute as PlayerGeneratorAttributeName, value: getPlayerAttributeValue(player, attribute as PlayerGeneratorAttributeName) ?? -1 }))
    .sort((left, right) => right.value - left.value);
  for (const entry of sortedAttributes) {
    pushUnique(signatureCandidates, entry.attribute);
    if (signatureCandidates.length >= 4) break;
  }

  const lowToHigh = [...sortedAttributes].sort((left, right) => left.value - right.value);
  for (const entry of lowToHigh) {
    pushUnique(weakCandidates, entry.attribute);
    if (weakCandidates.length >= 3) break;
  }

  const signatureAttributes = signatureCandidates
    .filter((attribute, index, list) => list.indexOf(attribute) === index)
    .slice(0, 2) as [PlayerGeneratorAttributeName, PlayerGeneratorAttributeName];
  while (signatureAttributes.length < 2) {
    signatureAttributes.push(playerGeneratorAttributeKeys[signatureAttributes.length] as PlayerGeneratorAttributeName);
  }
  const weakAttribute =
    weakCandidates.find((attribute) => !signatureAttributes.includes(attribute)) ??
    lowToHigh.find((entry) => !signatureAttributes.includes(entry.attribute))?.attribute ??
    "torment";

  return {
    playerId: player.id,
    signatureAttributes,
    weakAttribute,
    reasons: reasons.length > 0 ? reasons : ["attribute_profile_fallback"],
  };
}

export function getAttributeAffinityKind(attribute: PlayerGeneratorAttributeName, profile: AttributeAffinityProfile): AttributeAffinityKind {
  if (profile.signatureAttributes.includes(attribute)) return "signature";
  if (profile.weakAttribute === attribute) return "weak";
  return "neutral";
}
