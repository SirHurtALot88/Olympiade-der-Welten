export type TeamBoardObjective = {
  objectiveId: string;
  label: string;
  category: string;
  targetValue: number | string | boolean | null;
  currentValue: number | string | boolean | null;
  status: "open" | "completed" | "failed" | "at_risk";
};

export const TEAM_OBJECTIVE_CATEGORY_ORDER = [
  "SPORT",
  "FINANCE",
  "ROSTER",
  "PLAYER",
  "SPONSOR",
  "FACILITY",
  "DEVELOPMENT",
  "TRANSFER",
] as const;

export type TeamBoardObjectiveGroup = {
  category: string;
  objectives: TeamBoardObjective[];
};

export function groupObjectivesByCategory(objectives: TeamBoardObjective[]): TeamBoardObjectiveGroup[] {
  const byCategory = new Map<string, TeamBoardObjective[]>();

  for (const objective of objectives) {
    const key = objective.category.toUpperCase();
    const list = byCategory.get(key) ?? [];
    list.push(objective);
    byCategory.set(key, list);
  }

  const ordered: TeamBoardObjectiveGroup[] = [];

  for (const category of TEAM_OBJECTIVE_CATEGORY_ORDER) {
    const list = byCategory.get(category);
    if (list?.length) {
      ordered.push({ category, objectives: list });
      byCategory.delete(category);
    }
  }

  for (const [category, list] of [...byCategory.entries()].sort(([left], [right]) => left.localeCompare(right, "de"))) {
    ordered.push({ category, objectives: list });
  }

  return ordered;
}
