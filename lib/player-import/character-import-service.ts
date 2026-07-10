import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { Player, PlayerGeneratorAttributes } from "@/lib/data/olyDataTypes";
import { attachPlayerPortraitPath } from "@/lib/data/mediaAssets";
import { hydratePlayerWithAttributeSheet } from "@/lib/data/playerAttributeSheetData";
import { loadImportedPlayerStats } from "@/lib/data/playerStatsAdapter";
import { calculateImportedPlayerEconomy } from "@/lib/player-formulas/imported-player-economy";
import { createPlayerBaselineFromPlayer } from "@/lib/players/player-baseline-service";
import {
  clearPlayerSavePatches,
  upsertPlayerBaselineCatalogEntries,
  upsertPlayerCatalogEntries,
} from "@/lib/persistence/save-repository";
import {
  CANONICAL_NEGATIVE_TRAITS,
  CANONICAL_POSITIVE_TRAITS,
  PROGRESSION_CLASS_ORDER,
} from "@/lib/training/class-progression-config";
import { getTransfermarktTierFromPoints } from "@/lib/market/transfermarkt-sheet-stats";
import { rebuildLeagueDisciplineRatings } from "@/lib/player-formulas/discipline-rating-engine";

const ATTRIBUTE_KEYS: Array<keyof PlayerGeneratorAttributes> = [
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

export type OlympiadeCharacterBrief = {
  name: string;
  id?: string;
  className: string;
  race: string;
  alignment: string;
  gender: string;
  subclasses?: string[];
  traitsPositive?: string[];
  traitsNegative?: string[];
  attributes: PlayerGeneratorAttributes;
  flavorDe?: string;
  flavorEn?: string;
  portraitPath?: string | null;
  cost?: number;
  upkeepBase?: number;
};

export type CharacterImportValidationIssue = {
  field: string;
  message: string;
};

export type CharacterImportResult = {
  player: Player;
  attributeRow: Record<string, string | number | null>;
  validationIssues: CharacterImportValidationIssue[];
  economy: {
    marketValue: number;
    displayMarketValue: number;
    salaryDemand: number;
    displaySalary: number;
  };
};

function roundTo1(value: number) {
  return Number(value.toFixed(1));
}

function roundTo2(value: number) {
  return Number(value.toFixed(2));
}

function slugifyPlayerName(name: string) {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function buildPlayerId(name: string, existingPlayers: Player[]) {
  const maxNumber = existingPlayers.reduce((max, player) => {
    const match = player.id.match(/^player-(\d+)-/);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `player-${maxNumber + 1}-${slugifyPlayerName(name)}`;
}

export function validateCharacterBrief(brief: OlympiadeCharacterBrief): CharacterImportValidationIssue[] {
  const issues: CharacterImportValidationIssue[] = [];

  if (!brief.name.trim()) {
    issues.push({ field: "name", message: "Name fehlt." });
  }

  if (!PROGRESSION_CLASS_ORDER.includes(brief.className as (typeof PROGRESSION_CLASS_ORDER)[number])) {
    issues.push({ field: "className", message: `Ungueltige Klasse: ${brief.className}` });
  }

  for (const trait of brief.traitsPositive ?? []) {
    if (!CANONICAL_POSITIVE_TRAITS.includes(trait as (typeof CANONICAL_POSITIVE_TRAITS)[number])) {
      issues.push({ field: "traitsPositive", message: `Unbekanntes Positiv-Trait: ${trait}` });
    }
  }

  for (const trait of brief.traitsNegative ?? []) {
    if (!CANONICAL_NEGATIVE_TRAITS.includes(trait as (typeof CANONICAL_NEGATIVE_TRAITS)[number])) {
      issues.push({ field: "traitsNegative", message: `Unbekanntes Negativ-Trait: ${trait}` });
    }
  }

  for (const key of ATTRIBUTE_KEYS) {
    const value = brief.attributes[key];
    if (typeof value !== "number" || !Number.isFinite(value)) {
      issues.push({ field: `attributes.${key}`, message: `Attribut ${key} fehlt oder ist ungueltig.` });
      continue;
    }
    if (value < 1 || value > 99) {
      issues.push({ field: `attributes.${key}`, message: `Attribut ${key} ausserhalb 1-99: ${value}` });
    }
  }

  return issues;
}

function deriveCoreStats(attributes: PlayerGeneratorAttributes) {
  return {
    pow: roundTo1((attributes.power + attributes.health + attributes.stamina) / 3),
    spe: roundTo1((attributes.speed + attributes.dexterity + attributes.awareness) / 3),
    men: roundTo1((attributes.intelligence + attributes.awareness + attributes.determination + attributes.will) / 4),
    soc: roundTo1((attributes.charisma + attributes.spirit + attributes.torment) / 3),
  };
}

function materializeStatsPlayerFromBrief(
  brief: OlympiadeCharacterBrief,
  playerId: string,
  leaguePlayers: Player[],
): Omit<Player, "marketValue" | "salaryDemand" | "displayMarketValue" | "displaySalary"> {
  const attributeRow = buildAttributeRow(brief.name, brief.attributes);
  const draftPlayer = {
    id: playerId,
    name: brief.name.trim(),
    rating: 0,
    className: brief.className,
    race: brief.race,
    alignment: brief.alignment,
    gender: brief.gender,
    subclasses: brief.subclasses ?? [],
    traitsPositive: brief.traitsPositive ?? [],
    traitsNegative: brief.traitsNegative ?? [],
    coreStats: deriveCoreStats(brief.attributes),
    attributeSheetStats: {
      power: attributeRow.power,
      health: attributeRow.health,
      stamina: attributeRow.stamina,
      intelligence: attributeRow.intelligence,
      awareness: attributeRow.awareness,
      determination: attributeRow.determination,
      speed: attributeRow.speed,
      dexterity: attributeRow.dexterity,
      charisma: attributeRow.charisma,
      will: attributeRow.will,
      spirit: attributeRow.spirit,
      torment: attributeRow.torment,
    },
    attributeSheetRatings: {
      powerRating: attributeRow.powerRating,
      healthRating: attributeRow.healthRating,
      staminaRating: attributeRow.staminaRating,
      intelligenceRating: attributeRow.intelligenceRating,
      awarenessRating: attributeRow.awarenessRating,
      determinationRating: attributeRow.determinationRating,
      speedRating: attributeRow.speedRating,
      dexterityRating: attributeRow.dexterityRating,
      charismaRating: attributeRow.charismaRating,
      willRating: attributeRow.willRating,
      spiritRating: attributeRow.spiritRating,
      tormentRating: attributeRow.tormentRating,
    },
    preferredDisciplineIds: [],
    disciplineRatings: {},
    disciplineTierCounts: { above20: 0, above40: 0, above60: 0, above80: 0 },
    flavorEn: brief.flavorEn ?? "",
    flavorDe: brief.flavorDe ?? "",
    fatigue: 0,
    form: 0,
    potential: 0,
    cost: brief.cost ?? 0,
    upkeepBase: brief.upkeepBase ?? 0,
    portraitPath: brief.portraitPath ?? null,
    referenceClass: null,
    imageSource: null,
    bracketLabel: null,
  } satisfies Omit<Player, "marketValue" | "salaryDemand" | "displayMarketValue" | "displaySalary">;

  const ranked = rebuildLeagueDisciplineRatings(
    leaguePlayers.some((player) => player.id === playerId)
      ? leaguePlayers.map((player) => (player.id === playerId ? { ...player, ...draftPlayer } : player))
      : [...leaguePlayers, { ...draftPlayer, marketValue: 0, salaryDemand: 0, displayMarketValue: 0, displaySalary: 0 }],
  ).find((player) => player.id === playerId);

  if (!ranked) {
    throw new Error(`Failed to derive league discipline ratings for ${brief.name}`);
  }

  const disciplineRatings = ranked.disciplineRatings;
  const ratingValues = Object.values(disciplineRatings);
  const rating = roundTo2(ratingValues.reduce((sum, value) => sum + value, 0) / ratingValues.length);
  const topAverage = roundTo2(
    [...ratingValues].sort((left, right) => right - left).slice(0, 3).reduce((sum, value) => sum + value, 0) / 3,
  );

  return {
    ...draftPlayer,
    rating,
    preferredDisciplineIds: ranked.preferredDisciplineIds,
    disciplineRatings,
    disciplineTierCounts: ranked.disciplineTierCounts,
    potential: roundTo2(Math.max(rating, topAverage) + 4),
  };
}

function deriveRating(value: number) {
  return getTransfermarktTierFromPoints(value);
}

function buildAttributeRow(name: string, attributes: PlayerGeneratorAttributes) {
  return {
    name,
    height: null,
    ...attributes,
    powerRating: deriveRating(attributes.power),
    healthRating: deriveRating(attributes.health),
    staminaRating: deriveRating(attributes.stamina),
    intelligenceRating: deriveRating(attributes.intelligence),
    awarenessRating: deriveRating(attributes.awareness),
    determinationRating: deriveRating(attributes.determination),
    speedRating: deriveRating(attributes.speed),
    dexterityRating: deriveRating(attributes.dexterity),
    charismaRating: deriveRating(attributes.charisma),
    willRating: deriveRating(attributes.will),
    spiritRating: deriveRating(attributes.spirit),
    tormentRating: deriveRating(attributes.torment),
  };
}

function computeEconomyForPlayer(player: Player, catalogPlayers: Player[]) {
  const economy = calculateImportedPlayerEconomy(player, catalogPlayers);
  if (!economy) {
    throw new Error(`Official economy calculation failed for ${player.name} (${player.id})`);
  }
  return economy;
}

export function buildPlayerFromBrief(
  brief: OlympiadeCharacterBrief,
  existingPlayers: Player[] = loadImportedPlayerStats(),
): CharacterImportResult {
  const validationIssues = validateCharacterBrief(brief);
  const playerId = brief.id ?? buildPlayerId(brief.name, existingPlayers);
  const statsPlayer = materializeStatsPlayerFromBrief(brief, playerId, existingPlayers);
  const attributeRow = buildAttributeRow(brief.name, brief.attributes);

  const catalogPlayers = existingPlayers.some((player) => player.id === playerId)
    ? existingPlayers.map((player) => (player.id === playerId ? { ...player, ...statsPlayer } : player))
    : [...existingPlayers, { ...statsPlayer, marketValue: 0, salaryDemand: 0, displayMarketValue: 0, displaySalary: 0 }];

  const economy = computeEconomyForPlayer(
    {
      ...statsPlayer,
      marketValue: 0,
      salaryDemand: 0,
      displayMarketValue: 0,
      displaySalary: 0,
    },
    catalogPlayers,
  );
  const player = attachPlayerPortraitPath(
    hydratePlayerWithAttributeSheet({
      ...statsPlayer,
      ...economy,
    }),
  );

  return {
    player,
    attributeRow,
    validationIssues,
    economy,
  };
}

export function upsertCharacterInGeneratedCatalog(result: CharacterImportResult) {
  const statsPath = path.resolve(process.cwd(), "data/generated/oly-player-stats.json");
  const attributesPath = path.resolve(process.cwd(), "data/generated/oly-player-attributes.json");
  const portraitMapPath = path.resolve(process.cwd(), "data/generated/player-portrait-map.json");

  const stats = JSON.parse(readFileSync(statsPath, "utf8")) as Player[];
  const statsIndex = stats.findIndex((entry) => entry.id === result.player.id);
  if (statsIndex >= 0) {
    stats[statsIndex] = result.player;
  } else {
    stats.push(result.player);
  }
  writeFileSync(statsPath, `${JSON.stringify(stats, null, 2)}\n`, "utf8");

  const attributeRows = JSON.parse(readFileSync(attributesPath, "utf8")) as Array<Record<string, unknown>>;
  const attributeIndex = attributeRows.findIndex((entry) => entry.name === result.player.name);
  if (attributeIndex >= 0) {
    attributeRows[attributeIndex] = result.attributeRow;
  } else {
    attributeRows.push(result.attributeRow);
  }
  attributeRows.sort((left, right) => String(left.name).localeCompare(String(right.name), "de"));
  writeFileSync(attributesPath, `${JSON.stringify(attributeRows, null, 2)}\n`, "utf8");

  if (result.player.portraitPath) {
    const portraitMap = JSON.parse(readFileSync(portraitMapPath, "utf8")) as Record<string, string>;
    portraitMap[result.player.id] = result.player.portraitPath;
    writeFileSync(portraitMapPath, `${JSON.stringify(portraitMap, null, 2)}\n`, "utf8");
  }

  return {
    statsPath,
    attributesPath,
    portraitMapPath,
  };
}

export function syncImportedCharacterPersistence(result: CharacterImportResult) {
  const catalogPaths = upsertCharacterInGeneratedCatalog(result);
  upsertPlayerCatalogEntries([result.player]);
  upsertPlayerBaselineCatalogEntries([
    createPlayerBaselineFromPlayer(result.player, {
      source: "import",
      sourceFile: "references/character-briefs",
    }),
  ]);
  clearPlayerSavePatches(result.player.id);

  return catalogPaths;
}
