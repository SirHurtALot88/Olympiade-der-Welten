import attributeRows from "@/data/generated/oly-player-attributes.json";
import type { Player, PlayerAttributeSheetStats } from "@/lib/data/olyDataTypes";
import { normalizeAttributeSheetName, type PlayerAttributeSheetRow } from "@/lib/data/playerAttributeSheet";

type PlayerAttributeSheetRatings = NonNullable<Player["attributeSheetRatings"]>;

const rows = attributeRows as PlayerAttributeSheetRow[];

function normalizeName(name: string) {
  return normalizeAttributeSheetName(name).trim().toLocaleLowerCase("de");
}

const rowByNormalizedName = new Map(rows.map((row) => [normalizeName(row.name), row] as const));

function mergeStats(
  current: PlayerAttributeSheetStats | undefined,
  row: PlayerAttributeSheetRow,
): PlayerAttributeSheetStats {
  return {
    height: current?.height ?? row.height ?? null,
    power: current?.power ?? row.power ?? null,
    health: current?.health ?? row.health ?? null,
    stamina: current?.stamina ?? row.stamina ?? null,
    intelligence: current?.intelligence ?? row.intelligence ?? null,
    awareness: current?.awareness ?? row.awareness ?? null,
    determination: current?.determination ?? row.determination ?? null,
    speed: current?.speed ?? row.speed ?? null,
    dexterity: current?.dexterity ?? row.dexterity ?? null,
    charisma: current?.charisma ?? row.charisma ?? null,
    will: current?.will ?? row.will ?? null,
    spirit: current?.spirit ?? row.spirit ?? null,
    torment: current?.torment ?? row.torment ?? null,
  };
}

function mergeRatings(
  current: PlayerAttributeSheetRatings | undefined,
  row: PlayerAttributeSheetRow,
): PlayerAttributeSheetRatings {
  return {
    powerRating: current?.powerRating ?? row.powerRating ?? null,
    healthRating: current?.healthRating ?? row.healthRating ?? null,
    staminaRating: current?.staminaRating ?? row.staminaRating ?? null,
    intelligenceRating: current?.intelligenceRating ?? row.intelligenceRating ?? null,
    awarenessRating: current?.awarenessRating ?? row.awarenessRating ?? null,
    determinationRating: current?.determinationRating ?? row.determinationRating ?? null,
    speedRating: current?.speedRating ?? row.speedRating ?? null,
    dexterityRating: current?.dexterityRating ?? row.dexterityRating ?? null,
    charismaRating: current?.charismaRating ?? row.charismaRating ?? null,
    willRating: current?.willRating ?? row.willRating ?? null,
    spiritRating: current?.spiritRating ?? row.spiritRating ?? null,
    tormentRating: current?.tormentRating ?? row.tormentRating ?? null,
  };
}

export function hydratePlayerWithAttributeSheet(player: Player): Player {
  const row = rowByNormalizedName.get(normalizeName(player.name));
  if (!row) {
    return player;
  }

  return {
    ...player,
    attributeSheetStats: mergeStats(player.attributeSheetStats, row),
    attributeSheetRatings: mergeRatings(player.attributeSheetRatings, row),
  };
}

export function hydratePlayersWithAttributeSheet(players: Player[]) {
  return players.map(hydratePlayerWithAttributeSheet);
}

export function getGeneratedPlayerAttributeRows() {
  return rows;
}
