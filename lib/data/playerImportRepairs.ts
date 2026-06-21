import type { Player, PlayerAttributeSheetStats, PlayerGeneratorAttributes } from "@/lib/data/olyDataTypes";
import { loadPlayerFormulaSources } from "@/lib/player-formulas/formula-source-loader";
import { calculateMarketValueFromRankTable } from "@/lib/player-formulas/market-value-engine";
import { calculateSalaryFromMarketValue } from "@/lib/player-formulas/salary-engine";
import {
  officialDisciplineWeightMatrix,
  officialDisciplineWeightOrder,
  type PlayerGeneratorAttributeKey,
} from "@/lib/player-generator/official-discipline-weights";

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

function hasOnlyEmptyDisciplineRatings(player: Player) {
  const values = Object.values(player.disciplineRatings ?? {});
  return values.length === 0 || values.every((value) => !isFiniteNumber(value) || value <= 0);
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

function deriveDisciplineRatings(attributes: PlayerGeneratorAttributes) {
  const ratings: Record<string, number> = {};
  for (const disciplineId of officialDisciplineWeightOrder) {
    const weights = officialDisciplineWeightMatrix[disciplineId];
    const entries = Object.entries(weights) as Array<[PlayerGeneratorAttributeKey, number]>;
    const totalWeight = entries.reduce((sum, [, weight]) => sum + weight, 0);
    if (totalWeight <= 0) continue;
    const weightedValue = entries.reduce((sum, [attributeKey, weight]) => {
      return sum + attributes[attributeKey] * weight;
    }, 0);
    ratings[disciplineId] = roundTo1(Math.min(99, Math.max(1, weightedValue / totalWeight)));
  }
  return ratings;
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
  const disciplineRatings = hasOnlyEmptyDisciplineRatings(player)
    ? deriveDisciplineRatings(attributes)
    : player.disciplineRatings;
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

function hasMissingEconomy(player: Player) {
  const marketValue = player.displayMarketValue ?? player.marketValue;
  const salary = player.displaySalary ?? player.salaryDemand;
  return !isFiniteNumber(marketValue) || marketValue <= 0 || !isFiniteNumber(salary) || salary < 0;
}

function materializeCalculatedEconomyForMissingPlayers(players: Player[]) {
  const playersNeedingEconomy = players.filter((player) => isRileyLeRogue(player) && hasMissingEconomy(player));
  if (playersNeedingEconomy.length === 0) return players;

  const formulaSources = loadPlayerFormulaSources();
  const marketValueResult = calculateMarketValueFromRankTable({
    players: players
      .filter((player) => Object.values(player.disciplineRatings ?? {}).some((value) => isFiniteNumber(value) && value > 0))
      .map((player) => ({
        playerId: player.id,
        scores: player.disciplineRatings ?? {},
      })),
    rankToDisciplineMarketValue: formulaSources.rankToDisciplineMarketValue,
  });
  if (marketValueResult.status !== "ready") return players;

  const marketValueByPlayerId = new Map(
    marketValueResult.players.map((entry) => [entry.playerId, entry.marketValueNew] as const),
  );

  return players.map((player) => {
    if (!isRileyLeRogue(player) || !hasMissingEconomy(player)) return player;
    const marketValue = marketValueByPlayerId.get(player.id);
    const attributes = toGeneratorAttributes(player.attributeSheetStats);
    if (!isFiniteNumber(marketValue) || marketValue <= 0 || !attributes) return player;
    if (!formulaSources.attributeSalaryModifiers || !formulaSources.traitSalaryFactors) return player;

    const salary = calculateSalaryFromMarketValue({
      salaryMarketValue: marketValue,
      attributes,
      traitsPositive: player.traitsPositive ?? [],
      traitsNegative: player.traitsNegative ?? [],
      attributeSalaryModifiers: formulaSources.attributeSalaryModifiers,
      traitSalaryFactors: formulaSources.traitSalaryFactors,
    }).finalSalary;

    return {
      ...player,
      marketValue: roundTo2(marketValue),
      displayMarketValue: roundTo2(marketValue),
      cost: roundTo2(marketValue),
      salaryDemand: roundTo2(Math.max(0, salary)),
      displaySalary: roundTo2(Math.max(0, salary)),
      upkeepBase: roundTo2(Math.max(0, salary)),
    };
  });
}

export function repairImportedPlayerData(players: Player[]) {
  return materializeCalculatedEconomyForMissingPlayers(players.map(repairRileyLeRogue));
}
