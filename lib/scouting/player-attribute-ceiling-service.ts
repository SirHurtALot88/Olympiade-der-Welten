import type {
  Player,
  PlayerGeneratorAttributeName,
  PlayerPotentialRecord,
} from "@/lib/data/olyDataTypes";
import type { PlayerAxisKey } from "@/lib/scouting/player-axis-star-rating";
import type { PlayerPotentialCeilingProfile } from "@/lib/scouting/player-potential-ceiling-service";
import { playerGeneratorAttributeKeys } from "@/lib/player-generator/official-discipline-weights";

export type AttributeHeadroomState = "open" | "closing" | "capped";
export type AxisRouteState = "open" | "closing" | "capped";

const ATTRIBUTE_PRIMARY_AXIS: Record<PlayerGeneratorAttributeName, PlayerAxisKey> = {
  power: "pow",
  health: "pow",
  stamina: "pow",
  speed: "spe",
  dexterity: "spe",
  awareness: "spe",
  intelligence: "men",
  will: "men",
  charisma: "soc",
  spirit: "soc",
  determination: "soc",
  torment: "pow",
};

const AXIS_ATTRIBUTES: Record<PlayerAxisKey, PlayerGeneratorAttributeName[]> = {
  pow: ["power", "health", "stamina", "torment"],
  spe: ["speed", "dexterity", "awareness"],
  men: ["intelligence", "will", "awareness"],
  soc: ["charisma", "spirit", "determination"],
};

const CLOSING_HEADROOM_THRESHOLD = 5;
const CAPPED_HEADROOM_THRESHOLD = 1;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function getPlayerSeedValue(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

function getPlayerAttributeValue(player: Player, attribute: PlayerGeneratorAttributeName): number | null {
  const value = player.attributeSheetStats?.[attribute];
  return isFiniteNumber(value) ? value : null;
}

/** Maps axis PO stars to a hidden numeric ceiling baseline. */
export function mapAxisPoStarsToNumericCeiling(poStars: number) {
  return clamp(Math.round(35 + (clamp(poStars, 0.5, 5) / 5) * 55), 35, 99);
}

export function buildHiddenAttributeCeilings(input: {
  saveId: string;
  player: Player;
  axisCeiling: PlayerPotentialCeilingProfile;
}): Partial<Record<PlayerGeneratorAttributeName, number>> {
  const ceilings = {} as Partial<Record<PlayerGeneratorAttributeName, number>>;

  for (const attribute of playerGeneratorAttributeKeys) {
    const axis = ATTRIBUTE_PRIMARY_AXIS[attribute];
    const axisBase = mapAxisPoStarsToNumericCeiling(input.axisCeiling[axis]);
    const attributeSeed = getPlayerSeedValue(`${input.saveId}:${input.player.id}:${attribute}:attr-ceiling-v1`);
    const spread = 8 + attributeSeed * 10;
    const direction = attributeSeed > 0.5 ? 1 : -1;
    const current = getPlayerAttributeValue(input.player, attribute);
    const rawCeiling = axisBase + direction * spread;
    ceilings[attribute] = clamp(
      Math.max(current ?? 35, Math.round(rawCeiling)),
      1,
      99,
    );
  }

  return ceilings;
}

export function getAttributeHeadroom(input: {
  player: Player;
  attribute: PlayerGeneratorAttributeName;
  record?: PlayerPotentialRecord | null;
}) {
  const current = getPlayerAttributeValue(input.player, input.attribute);
  const ceiling = input.record?.hiddenAttributeCeiling?.[input.attribute] ?? null;
  if (!isFiniteNumber(current) || !isFiniteNumber(ceiling)) {
    return {
      current,
      ceiling,
      headroom: null as number | null,
      state: "open" as AttributeHeadroomState,
    };
  }
  const headroom = ceiling - current;
  let state: AttributeHeadroomState = "open";
  if (headroom <= CAPPED_HEADROOM_THRESHOLD) state = "capped";
  else if (headroom <= CLOSING_HEADROOM_THRESHOLD) state = "closing";
  return { current, ceiling, headroom, state };
}

export function getAttributeGrowthMultiplier(state: AttributeHeadroomState) {
  if (state === "capped") return 0.05;
  if (state === "closing") return 0.45;
  return 1;
}

export function getAxisRouteState(input: {
  caStars: number;
  poStars: number;
}): AxisRouteState {
  const gap = input.poStars - input.caStars;
  if (gap <= 0.25) return "capped";
  if (gap <= 0.75) return "closing";
  return "open";
}

export function getAxisRouteTrainingMultiplier(state: AxisRouteState) {
  if (state === "capped") return 0.1;
  if (state === "closing") return 0.55;
  return 1;
}

export function getAxisRouteLabel(state: AxisRouteState, gapStars: number) {
  if (state === "capped") return "Limit erreicht";
  if (state === "closing") return `+${gapStars.toFixed(1)}★ Luft (eng)`;
  return `+${gapStars.toFixed(1)}★ Luft`;
}

export function getHeadroomLabel(state: AttributeHeadroomState, headroom: number | null) {
  if (state === "capped") return "am Limit";
  if (state === "closing") return headroom != null ? `noch ~${Math.max(1, Math.round(headroom))}` : "eng";
  return headroom != null ? `noch ~${Math.max(1, Math.round(headroom))}` : "offen";
}

export function getAttributesForAxis(axis: PlayerAxisKey) {
  return AXIS_ATTRIBUTES[axis];
}

export function getPrimaryAxisForAttribute(attribute: PlayerGeneratorAttributeName) {
  return ATTRIBUTE_PRIMARY_AXIS[attribute];
}

export function resolvePlayerPotentialRecordFromGameState(input: {
  gameState?: { playerPotential?: PlayerPotentialRecord[] } | null;
  playerId: string;
}): PlayerPotentialRecord | null {
  return input.gameState?.playerPotential?.find((entry) => entry.playerId === input.playerId) ?? null;
}
