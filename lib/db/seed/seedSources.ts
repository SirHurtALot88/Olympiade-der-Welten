import { foundationSeedDisciplines, foundationSeedSeason } from "../../data/dataAdapter";
import type { PlayerAttributeKey } from "@prisma/client";
import {
  SPIEL_EIGNUNG_OVERRIDE_SOURCE,
  hasSpielEignungOverride,
  resolveDisciplineWeightProfile,
} from "../../player-generator/spiel-eignung-overrides";

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

export const OFFICIAL_DISCIPLINE_WEIGHT_SOURCE = "official-weighted-average-matrix-2026-06";

/**
 * Alle Herkunftsvermerke, die `disciplineWeightSeedRows` erzeugen KANN.
 *
 * `prisma/seed.ts` raeumt nach dem Seed jede DisciplineWeight-Zeile weg, deren `source` hier
 * NICHT drinsteht (Zweck: Altbestand aus frueheren Quellen loeschen). Kommt ein neuer
 * Herkunftsvermerk dazu, MUSS er hier stehen — sonst loescht der Seed die Zeilen, die er
 * gerade selbst geschrieben hat, und die Disziplin steht lautlos ohne Gewichte da.
 */
export const DISCIPLINE_WEIGHT_SEED_SOURCES = [
  OFFICIAL_DISCIPLINE_WEIGHT_SOURCE,
  SPIEL_EIGNUNG_OVERRIDE_SOURCE,
] as const;

// GEWICHTSQUELLE: `resolveDisciplineWeightProfile` statt der Matrix direkt — eine Disziplin
// mit Spiel-Eignungs-Override (heute nur Football) seedet DEREN Gewichte, jede andere
// unveraendert die offizielle Matrix. Diese Zeilen sind die DB-Kopie, aus der `weightPct`
// von `lib/ai/ai-needs-engine.ts`, `lib/lineups/matchday-slot-roles.ts` und den
// `legacy-lineup-*`-Diensten gelesen wird; liefe sie der Rating-Rechnung davon, haette man
// wieder zwei Ordnungen desselben Kaders (s. lib/player-generator/spiel-eignung-overrides.ts).
export const disciplineWeightSeedRows: DisciplineWeightSeedRow[] = foundationSeedDisciplines.flatMap((discipline) => {
  const weights = resolveDisciplineWeightProfile(discipline.id);
  const source = hasSpielEignungOverride(discipline.id)
    ? SPIEL_EIGNUNG_OVERRIDE_SOURCE
    : OFFICIAL_DISCIPLINE_WEIGHT_SOURCE;

  return (Object.entries(weights) as Array<[PlayerAttributeKey, number]>)
    .filter(([, weightPct]) => weightPct > 0)
    .map(([attributeKey, weightPct]) => ({
      seasonId: foundationSeedSeason.id,
      disciplineId: discipline.id,
      disciplineKey: discipline.id,
      attributeKey,
      weightPct,
      source,
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
