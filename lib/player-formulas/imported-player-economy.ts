import type { Player, PlayerAttributeSheetStats, PlayerGeneratorAttributes } from "@/lib/data/olyDataTypes";
import { computeLeagueMarketValueMapFromPlayers } from "@/lib/player-formulas/league-market-value-snapshot";
import { loadPlayerFormulaSources } from "@/lib/player-formulas/formula-source-loader";
import { calculateSalaryFromMarketValue } from "@/lib/player-formulas/salary-engine";

export type ImportedPlayerEconomy = {
  marketValue: number;
  displayMarketValue: number;
  salaryDemand: number;
  displaySalary: number;
};

function roundTo2(value: number) {
  return Number(value.toFixed(2));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
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

function hasDisciplineScores(player: Player) {
  return Object.values(player.disciplineRatings ?? {}).some((value) => isFiniteNumber(value) && value > 0);
}

export function calculateImportedPlayerEconomy(
  player: Player,
  catalogPlayers: Player[],
  marketValueByPlayerId?: Map<string, number>,
): ImportedPlayerEconomy | null {
  if (!hasDisciplineScores(player)) {
    return null;
  }

  const attributes = toGeneratorAttributes(player.attributeSheetStats);
  if (!attributes) {
    return null;
  }

  const formulaSources = loadPlayerFormulaSources();
  if (!formulaSources.attributeSalaryModifiers || !formulaSources.traitSalaryFactors) {
    return null;
  }

  const resolvedMarketValueByPlayerId =
    marketValueByPlayerId ??
    computeLeagueMarketValueMapFromPlayers(catalogPlayers);

  const marketValueRaw = resolvedMarketValueByPlayerId.get(player.id);
  if (!isFiniteNumber(marketValueRaw) || marketValueRaw <= 0) {
    return null;
  }

  const marketValue = roundTo2(marketValueRaw);
  const salaryDemand = roundTo2(
    calculateSalaryFromMarketValue({
      salaryMarketValue: marketValue,
      attributes,
      traitsPositive: player.traitsPositive ?? [],
      traitsNegative: player.traitsNegative ?? [],
      attributeSalaryModifiers: formulaSources.attributeSalaryModifiers,
      traitSalaryFactors: formulaSources.traitSalaryFactors,
    }).finalSalary,
  );

  if (!isFiniteNumber(salaryDemand) || salaryDemand < 0) {
    return null;
  }

  return {
    marketValue,
    displayMarketValue: marketValue,
    salaryDemand,
    displaySalary: salaryDemand,
  };
}

export function applyImportedPlayerEconomy(player: Player, economy: ImportedPlayerEconomy): Player {
  return {
    ...player,
    marketValue: economy.marketValue,
    displayMarketValue: economy.displayMarketValue,
    salaryDemand: economy.salaryDemand,
    displaySalary: economy.displaySalary,
    cost: player.cost ?? economy.marketValue,
    upkeepBase: player.upkeepBase ?? economy.salaryDemand,
  };
}

/** Recompute rank-table MW and salary engine values for imported catalog players. */
export function materializeCalculatedEconomyForPlayers(players: Player[]): Player[] {
  const marketValueByPlayerId = computeLeagueMarketValueMapFromPlayers(players);

  if (marketValueByPlayerId.size === 0) {
    return players;
  }

  return players.map((player) => {
    const economy = calculateImportedPlayerEconomy(player, players, marketValueByPlayerId);
    return economy ? applyImportedPlayerEconomy(player, economy) : player;
  });
}
