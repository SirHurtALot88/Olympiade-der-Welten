import type { Discipline, Player, RosterEntry, Team, TeamIdentity } from "../../data/olyDataTypes";

import type { DisciplineWeightSeedRow, SeasonDisciplineConfigSeedRow } from "./seedSources";

export function toNullableString(value: string | null | undefined) {
  return value && value.length > 0 ? value : null;
}

export function toInt(value: number) {
  return Math.round(value);
}

export function toFloat(value: number) {
  return Number(value.toFixed(2));
}

export function buildTeamSeasonStateId(saveId: string, seasonId: string, teamId: string) {
  return `${saveId}:${seasonId}:${teamId}`;
}

export function buildPlayerAttributeId(playerId: string) {
  return `attr:${playerId}`;
}

export function buildPlayerDisciplineScoreId(playerId: string, disciplineId: string) {
  return `pds:${playerId}:${disciplineId}`;
}

export function buildActivePlayerId(saveId: string, seasonId: string, playerId: string) {
  return `active:${saveId}:${seasonId}:${playerId}`;
}

export function buildDisciplineWeightId(seasonId: string | null, disciplineId: string, attributeKey: string) {
  return `dw:${seasonId ?? "global"}:${disciplineId}:${attributeKey}`;
}

export function buildSeasonDisciplineConfigId(seasonId: string, disciplineId: string) {
  return `sdc:${seasonId}:${disciplineId}`;
}

export function mapTeamRecord(team: Team) {
  return {
    id: team.teamId,
    shortCode: team.shortCode,
    name: team.name,
    logoPath: team.logoPath ?? null,
    logoUrl: null,
  };
}

export function mapTeamSeasonStateRecord(input: {
  saveId: string;
  seasonId: string;
  team: Team;
  identity?: TeamIdentity;
}) {
  const { saveId, seasonId, team, identity } = input;

  return {
    id: buildTeamSeasonStateId(saveId, seasonId, team.teamId),
    saveId,
    seasonId,
    teamId: team.teamId,
    cash: toInt(team.cash),
    budget: toInt(team.budget),
    humanControlled: team.humanControlled,
    rosterLimit: team.rosterLimit,
    pow: identity?.pow ?? 0,
    spe: identity?.spe ?? 0,
    men: identity?.men ?? 0,
    soc: identity?.soc ?? 0,
    ambition: identity?.ambition ?? 0,
    finances: identity?.finances ?? 0,
    boardConfidence: identity?.boardConfidence ?? 0,
    harmony: identity?.harmony ?? 0,
    manners: identity?.manners ?? 0,
    popularity: identity?.popularity ?? 0,
    cooperation: identity?.cooperation ?? 0,
    playerMin: identity?.playerMin ?? 0,
    playerOpt: identity?.playerOpt ?? 0,
    sponsor: null,
    sourceNote: identity?.sourceNote ?? null,
  };
}

export function mapPlayerRecord(player: Player) {
  return {
    id: player.id,
    name: player.name,
    portraitPath: player.portraitPath ?? null,
    portraitUrl: null,
    className: player.className,
    race: player.race,
    alignment: player.alignment,
    gender: player.gender,
    referenceClass: player.referenceClass ?? null,
    imageSource: player.imageSource ?? null,
    bracketLabel: player.bracketLabel ?? null,
    flavorEn: player.flavorEn,
    flavorDe: player.flavorDe,
    subclasses: player.subclasses,
    traitsPositive: player.traitsPositive,
    traitsNegative: player.traitsNegative,
    preferredDisciplineIds: player.preferredDisciplineIds,
  };
}

export function mapPlayerAttributeRecord(player: Player) {
  return {
    id: buildPlayerAttributeId(player.id),
    playerId: player.id,
    rating: toFloat(player.rating),
    marketValue: toInt(player.marketValue),
    salaryDemand: toInt(player.salaryDemand),
    displayMarketValue: toFloat(player.displayMarketValue ?? player.marketValue),
    displaySalary: toFloat(player.displaySalary ?? player.salaryDemand),
    cost: toInt(player.cost ?? player.marketValue),
    upkeepBase: toInt(player.upkeepBase ?? player.salaryDemand),
    pow: toFloat(player.coreStats.pow),
    spe: toFloat(player.coreStats.spe),
    men: toFloat(player.coreStats.men),
    soc: toFloat(player.coreStats.soc),
    power: player.attributeSheetStats?.power != null ? toFloat(player.attributeSheetStats.power) : null,
    health: player.attributeSheetStats?.health != null ? toFloat(player.attributeSheetStats.health) : null,
    stamina: player.attributeSheetStats?.stamina != null ? toFloat(player.attributeSheetStats.stamina) : null,
    intelligence:
      player.attributeSheetStats?.intelligence != null ? toFloat(player.attributeSheetStats.intelligence) : null,
    awareness: player.attributeSheetStats?.awareness != null ? toFloat(player.attributeSheetStats.awareness) : null,
    determination:
      player.attributeSheetStats?.determination != null ? toFloat(player.attributeSheetStats.determination) : null,
    speed: player.attributeSheetStats?.speed != null ? toFloat(player.attributeSheetStats.speed) : null,
    dexterity: player.attributeSheetStats?.dexterity != null ? toFloat(player.attributeSheetStats.dexterity) : null,
    charisma: player.attributeSheetStats?.charisma != null ? toFloat(player.attributeSheetStats.charisma) : null,
    will: player.attributeSheetStats?.will != null ? toFloat(player.attributeSheetStats.will) : null,
    spirit: player.attributeSheetStats?.spirit != null ? toFloat(player.attributeSheetStats.spirit) : null,
    torment: player.attributeSheetStats?.torment != null ? toFloat(player.attributeSheetStats.torment) : null,
    powerRating: player.attributeSheetRatings?.powerRating ?? null,
    healthRating: player.attributeSheetRatings?.healthRating ?? null,
    staminaRating: player.attributeSheetRatings?.staminaRating ?? null,
    intelligenceRating: player.attributeSheetRatings?.intelligenceRating ?? null,
    awarenessRating: player.attributeSheetRatings?.awarenessRating ?? null,
    determinationRating: player.attributeSheetRatings?.determinationRating ?? null,
    speedRating: player.attributeSheetRatings?.speedRating ?? null,
    dexterityRating: player.attributeSheetRatings?.dexterityRating ?? null,
    charismaRating: player.attributeSheetRatings?.charismaRating ?? null,
    willRating: player.attributeSheetRatings?.willRating ?? null,
    spiritRating: player.attributeSheetRatings?.spiritRating ?? null,
    tormentRating: player.attributeSheetRatings?.tormentRating ?? null,
    fatigue: toFloat(player.fatigue),
    form: toFloat(player.form),
    potential: toFloat(player.potential),
    above20: player.disciplineTierCounts.above20,
    above40: player.disciplineTierCounts.above40,
    above60: player.disciplineTierCounts.above60,
    above80: player.disciplineTierCounts.above80,
  };
}

export function mapPlayerDisciplineScoreRecords(player: Player, disciplines: Discipline[]) {
  return disciplines.map((discipline) => ({
    id: buildPlayerDisciplineScoreId(player.id, discipline.id),
    playerId: player.id,
    disciplineId: discipline.id,
    score: toFloat(player.disciplineRatings[discipline.id] ?? 0),
  }));
}

export function mapDisciplineRecord(discipline: Discipline) {
  return {
    id: discipline.id,
    name: discipline.name,
    category: discipline.category,
  };
}

export function mapDisciplineWeightRecord(row: DisciplineWeightSeedRow) {
  return {
    id: buildDisciplineWeightId(row.seasonId, row.disciplineId, row.attributeKey),
    seasonId: row.seasonId,
    disciplineId: row.disciplineId,
    disciplineKey: row.disciplineKey,
    attributeKey: row.attributeKey,
    weightPct: toFloat(row.weightPct),
    source: row.source ?? null,
  };
}

export function mapSeasonDisciplineConfigRecord(row: SeasonDisciplineConfigSeedRow) {
  return {
    id: buildSeasonDisciplineConfigId(row.seasonId, row.disciplineId),
    seasonId: row.seasonId,
    disciplineId: row.disciplineId,
    originalOrder: row.originalOrder ?? null,
    displayOrder: row.displayOrder ?? null,
    playerCount: row.playerCount ?? null,
    mutator1: toNullableString(row.mutator1),
    mutator2: toNullableString(row.mutator2),
    colorGroup: toNullableString(row.colorGroup),
  };
}

export function mapActivePlayerRecord(input: {
  saveId: string;
  seasonId: string;
  rosterEntry: RosterEntry;
}) {
  const { saveId, seasonId, rosterEntry } = input;

  return {
    id: buildActivePlayerId(saveId, seasonId, rosterEntry.playerId),
    saveId,
    seasonId,
    teamId: rosterEntry.teamId,
    playerId: rosterEntry.playerId,
    status: "active" as const,
    roleTag: rosterEntry.roleTag,
    contractLength: rosterEntry.contractLength,
    salary: toInt(rosterEntry.salary),
    upkeep: toInt(rosterEntry.upkeep),
    purchasePrice: rosterEntry.purchasePrice == null ? null : toInt(rosterEntry.purchasePrice),
    currentValue: rosterEntry.currentValue == null ? null : toInt(rosterEntry.currentValue),
    joinedSeasonId: rosterEntry.joinedSeasonId,
  };
}
