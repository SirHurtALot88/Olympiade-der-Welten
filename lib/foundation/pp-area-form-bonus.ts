import type { GameState } from "@/lib/data/olyDataTypes";
import { resolveSeasonDisciplineAreaTotal } from "@/lib/season/season-discipline-area-groups";

export type PpAreaKey = "total" | "pow" | "spe" | "men" | "soc";
export type PpAreaFormBonusTotals = Record<PpAreaKey, number>;

export type PpAreaTotals = Record<Exclude<PpAreaKey, "total">, number | null> & { total: number | null };

export type PpAreaSeasonStandRowInput = {
  disciplineValues: Record<string, number | null | undefined>;
  ppsTotal: number;
  ppsPow: number;
  ppsSpe: number;
  ppsMen: number;
  ppsSoc: number;
};

export function createEmptyPpAreaFormBonusTotals(): PpAreaFormBonusTotals {
  return {
    total: 0,
    pow: 0,
    spe: 0,
    men: 0,
    soc: 0,
  };
}

function getPpAreaKeyForDisciplineCategory(category: string | null | undefined): Exclude<PpAreaKey, "total"> | null {
  if (category === "power") return "pow";
  if (category === "speed") return "spe";
  if (category === "mental") return "men";
  if (category === "social") return "soc";
  return null;
}

export function buildPpAreaFormBonusByTeamId(
  gameState: GameState,
  seasonId: string,
): Record<string, PpAreaFormBonusTotals> {
  const selectedSnapshot =
    (gameState.seasonState.seasonSnapshots ?? []).find((snapshot) => snapshot.seasonId === seasonId) ?? null;
  const matchdayResults =
    selectedSnapshot?.matchdayResults ??
    (gameState.seasonState.matchdayResults ?? []).filter((result) => result.seasonId === seasonId);
  const resultIds = new Set(
    matchdayResults
      .filter((result) => result.status === "preview_applied")
      .map((result) => result.id),
  );
  const disciplineResults = selectedSnapshot?.disciplineResults ?? gameState.seasonState.disciplineResults ?? [];
  const disciplineCategoryById = new Map(
    gameState.disciplines.map((discipline) => [discipline.id, discipline.category] as const),
  );
  const totalsByTeamId = new Map<string, PpAreaFormBonusTotals>();

  for (const result of disciplineResults) {
    if (resultIds.size > 0 && !resultIds.has(result.matchdayResultId)) {
      continue;
    }

    const formModifier = result.formModifier ?? null;
    if (formModifier == null || !Number.isFinite(formModifier) || Math.abs(formModifier) < 0.05) {
      continue;
    }

    const areaKey = getPpAreaKeyForDisciplineCategory(disciplineCategoryById.get(result.disciplineId));
    if (!areaKey) {
      continue;
    }

    const current = totalsByTeamId.get(result.teamId) ?? createEmptyPpAreaFormBonusTotals();
    current.total = Number((current.total + formModifier).toFixed(1));
    current[areaKey] = Number((current[areaKey] + formModifier).toFixed(1));
    totalsByTeamId.set(result.teamId, current);
  }

  return Object.fromEntries(totalsByTeamId.entries());
}

function formatLocalePoints(value: number, maximumFractionDigits: number) {
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(value);
}

export function formatPpFormBonus(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value) || Math.abs(value) < 0.05) {
    return null;
  }

  const digits = Math.abs(value % 1) > 0.05 ? 1 : 0;
  return `${value > 0 ? "+" : ""}${formatLocalePoints(value, digits)}`;
}

export function formatPpFormBonusParen(value: number | null | undefined) {
  const formatted = formatPpFormBonus(value);
  return formatted ? `(${formatted})` : null;
}

export function resolvePpAreaTotalsFromSeasonRow(row: PpAreaSeasonStandRowInput): PpAreaTotals {
  const pow = resolveSeasonDisciplineAreaTotal(row.disciplineValues, "pow", row.ppsPow);
  const spe = resolveSeasonDisciplineAreaTotal(row.disciplineValues, "spe", row.ppsSpe);
  const men = resolveSeasonDisciplineAreaTotal(row.disciplineValues, "men", row.ppsMen);
  const soc = resolveSeasonDisciplineAreaTotal(row.disciplineValues, "soc", row.ppsSoc);

  const areaSum = Number(
    [pow, spe, men, soc]
      .map((value) => (value != null && Number.isFinite(value) ? value : 0))
      .reduce((sum, value) => sum + value, 0)
      .toFixed(1),
  );

  const total = areaSum > 0 ? areaSum : row.ppsTotal > 0 ? Number(row.ppsTotal.toFixed(1)) : areaSum;

  return { total, pow, spe, men, soc };
}
