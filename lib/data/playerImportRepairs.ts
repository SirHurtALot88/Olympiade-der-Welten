import type { Player, PlayerAttributeSheetStats, PlayerGeneratorAttributes } from "@/lib/data/olyDataTypes";
import { materializeCalculatedEconomyForPlayers } from "@/lib/player-formulas/imported-player-economy";

const RILEY_LE_ROGUE_ID = "player-0154-riley-le-rouge";

function roundTo1(value: number) {
  return Number(value.toFixed(1));
}

function roundTo2(value: number) {
  return Number(value.toFixed(2));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeText(value: string | null | undefined) {
  return (value ?? "").trim().toLocaleLowerCase("de");
}

function toGeneratorAttributes(stats?: PlayerAttributeSheetStats | null): PlayerGeneratorAttributes | null {
  if (!stats) return null;
  const attributes = {
    power: stats.power,
    health: stats.health,
    stamina: stats.stamina,
    intelligence: stats.intelligence,
    awareness: stats.awareness,
    determination: stats.determination,
    speed: stats.speed,
    dexterity: stats.dexterity,
    charisma: stats.charisma,
    will: stats.will,
    spirit: stats.spirit,
    torment: stats.torment,
  };

  return Object.values(attributes).every(isFiniteNumber)
    ? (attributes as PlayerGeneratorAttributes)
    : null;
}

function deriveCoreStats(attributes: PlayerGeneratorAttributes) {
  return {
    pow: roundTo1((attributes.power + attributes.health + attributes.stamina) / 3),
    spe: roundTo1((attributes.speed + attributes.dexterity + attributes.awareness) / 3),
    men: roundTo1((attributes.intelligence + attributes.awareness + attributes.determination + attributes.will) / 4),
    soc: roundTo1((attributes.charisma + attributes.spirit + attributes.torment) / 3),
  };
}

function tierCounts(ratings: Record<string, number>) {
  const values = Object.values(ratings);
  return {
    above20: values.filter((value) => value > 20).length,
    above40: values.filter((value) => value > 40).length,
    above60: values.filter((value) => value > 60).length,
    above80: values.filter((value) => value > 80).length,
  };
}

function preferredDisciplines(ratings: Record<string, number>) {
  return Object.entries(ratings)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([disciplineId]) => disciplineId);
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function isRileyLeRogue(player: Player) {
  const name = normalizeText(player.name);
  return player.id === RILEY_LE_ROGUE_ID || name === "riley le rouge" || name === "riley le rogue";
}

function cleanTags(values: string[] | null | undefined) {
  return (values ?? []).filter((value) => value && value !== "#N/A");
}

function repairRileyLeRogue(player: Player): Player {
  if (!isRileyLeRogue(player)) return player;
  const attributes = toGeneratorAttributes(player.attributeSheetStats);
  if (!attributes) {
    return {
      ...player,
      name: "Riley Le Rogue",
    };
  }

  const coreStats = deriveCoreStats(attributes);
  const disciplineRatings = player.disciplineRatings;
  const ratingValues = Object.values(disciplineRatings).filter(isFiniteNumber);
  const rating = roundTo2(average(ratingValues));
  const topAverage = roundTo2(
    average([...ratingValues].sort((left, right) => right - left).slice(0, 3)),
  );

  return {
    ...player,
    name: "Riley Le Rogue",
    rating: player.rating > 0 ? player.rating : rating,
    className: player.className === "#N/A" ? "Rogue" : player.className,
    race: player.race === "#N/A" ? "Unknown" : player.race,
    alignment: player.alignment === "#N/A" ? "N" : player.alignment,
    gender: player.gender === "#N/A" ? "x" : player.gender,
    subclasses: cleanTags(player.subclasses),
    traitsPositive: cleanTags(player.traitsPositive),
    traitsNegative: cleanTags(player.traitsNegative),
    coreStats,
    disciplineRatings,
    preferredDisciplineIds: player.preferredDisciplineIds.length > 0
      ? player.preferredDisciplineIds
      : preferredDisciplines(disciplineRatings),
    disciplineTierCounts: tierCounts(disciplineRatings),
    potential: player.potential > 5 ? player.potential : Math.max(topAverage, rating),
  };
}

export function repairImportedPlayerData(players: Player[]) {
  const repaired = players.map(repairRileyLeRogue);
  return materializeCalculatedEconomyForPlayers(repaired);
}
