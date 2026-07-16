import { foundationSeedDisciplines, foundationSeedSeason } from "../../data/dataAdapter";
import type { PlayerAttributeKey } from "@prisma/client";
import { officialDisciplineWeightMatrix } from "../../player-generator/official-discipline-weights";

export type DisciplineWeightSeedRow = {
  seasonId: string | null;
  disciplineId: string;
  disciplineKey: string;
  attributeKey: PlayerAttributeKey;
  weightPct: number;
  source?: string;
};

export type SeasonDisciplineConfigSeedRow = {
  seasonId: string;
  disciplineId: string;
  originalOrder?: number | null;
  displayOrder?: number | null;
  playerCount?: number | null;
  mutator1?: string | null;
  mutator2?: string | null;
  colorGroup?: string | null;
};

const categoryColorGroup: Record<string, string> = {
  power: "red",
  speed: "green",
  mental: "blue",
  social: "yellow",
};

export const disciplineWeightSeedRows: DisciplineWeightSeedRow[] = foundationSeedDisciplines.flatMap((discipline) => {
  const officialWeights =
    officialDisciplineWeightMatrix[discipline.id as keyof typeof officialDisciplineWeightMatrix] ?? {};

  return (Object.entries(officialWeights) as Array<[PlayerAttributeKey, number]>)
    .filter(([, weightPct]) => weightPct > 0)
    .map(([attributeKey, weightPct]) => ({
      seasonId: foundationSeedSeason.id,
      disciplineId: discipline.id,
      disciplineKey: discipline.id,
      attributeKey,
      weightPct,
      source: "official-weighted-average-matrix-2026-06",
    }));
});

export const seasonDisciplineConfigSeedRows: SeasonDisciplineConfigSeedRow[] = foundationSeedDisciplines.map((discipline) => ({
  seasonId: foundationSeedSeason.id,
  disciplineId: discipline.id,
  originalOrder: discipline.originalOrder ?? null,
  displayOrder: discipline.displayOrder ?? null,
  playerCount: discipline.playerCount ?? null,
  mutator1: discipline.mutator1 ?? null,
  mutator2: discipline.mutator2 ?? null,
  colorGroup: categoryColorGroup[discipline.category] ?? null,
}));
