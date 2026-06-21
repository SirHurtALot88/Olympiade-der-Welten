import type { MatchdayMvpScoreboardRow } from "@/lib/season/matchday-mvp-scoring-service";

export const MATCHDAY_ARENA_PHASES = [
  { id: "slots", label: "Slots" },
  { id: "push", label: "Push" },
  { id: "form", label: "Form" },
  { id: "mutator", label: "Mutator" },
  { id: "captain", label: "Captain" },
  { id: "final", label: "Final" },
  { id: "result", label: "Result" },
] as const;

export type MatchdayArenaPhaseId = (typeof MATCHDAY_ARENA_PHASES)[number]["id"];

export type MatchdayArenaScoreboardRowView = MatchdayMvpScoreboardRow & {
  baseRank: number;
  rankDelta: number;
  currentScore: number;
  pushScore: number | null;
  formScore: number | null;
  captainScore: number | null;
  totalMutatorScore: number | null;
};

export type MatchdayArenaPhaseBreakdownItem = {
  id: "slots" | "push" | "form" | "mutator" | "captain";
  label: string;
  valueLabel: string;
  tone: "neutral" | "positive" | "negative";
};

function roundArenaScore(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) {
    return null;
  }
  return Number(value.toFixed(1));
}

export function buildMatchdayArenaScoreboardView(
  rows: MatchdayMvpScoreboardRow[],
): MatchdayArenaScoreboardRowView[] {
  const rankedByBase = [...rows]
    .sort((left, right) => {
      if (right.baseScore !== left.baseScore) {
        return right.baseScore - left.baseScore;
      }
      return left.teamName.localeCompare(right.teamName, "de");
    })
    .map((row, index) => ({
      teamId: row.teamId,
      rank: index + 1,
    }));

  const baseRankByTeamId = new Map(rankedByBase.map((entry) => [entry.teamId, entry.rank]));

  return rows.map((row) => {
    const pushScore = roundArenaScore(row.intensityModifier ?? 0);
    const captainScore =
      row.captainStatus === "mapped" ? roundArenaScore(row.captainModifier ?? 0) : null;
    const formScore =
      row.formCardStatus === "ready" ? roundArenaScore(row.formCardModifier ?? 0) : null;
    const totalMutatorScore =
      row.mutator1Modifier != null || row.mutator2Modifier != null
        ? roundArenaScore((row.mutator1Modifier ?? 0) + (row.mutator2Modifier ?? 0))
        : null;
    const baseRank = baseRankByTeamId.get(row.teamId) ?? row.rank;

    return {
      ...row,
      baseRank,
      rankDelta: baseRank - row.rank,
      currentScore: roundArenaScore(row.baseScore + (pushScore ?? 0)) ?? row.baseScore,
      pushScore,
      formScore,
      captainScore,
      totalMutatorScore,
    };
  });
}

export function getMatchdayArenaPhaseScore(
  row: MatchdayArenaScoreboardRowView,
  phaseId: MatchdayArenaPhaseId,
) {
  const pushPhaseScore = row.currentScore;
  const formPhaseScore =
    row.formCardStatus === "ready"
      ? pushPhaseScore + (row.formScore ?? 0)
      : pushPhaseScore;
  const mutatorPhaseScore =
    row.totalMutatorScore != null ? formPhaseScore + row.totalMutatorScore : formPhaseScore;
  const captainPhaseScore =
    row.captainStatus === "mapped"
      ? mutatorPhaseScore + (row.captainScore ?? 0)
      : mutatorPhaseScore;

  switch (phaseId) {
    case "slots":
      return roundArenaScore(row.baseScore);
    case "push":
      return roundArenaScore(pushPhaseScore);
    case "form":
      return roundArenaScore(formPhaseScore);
    case "mutator":
      return roundArenaScore(mutatorPhaseScore);
    case "captain":
      return roundArenaScore(captainPhaseScore);
    case "final":
    case "result":
      return roundArenaScore(row.score);
    default:
      return roundArenaScore(row.score);
  }
}

export function getMatchdayArenaPhaseDelta(
  row: MatchdayArenaScoreboardRowView,
  phaseId: MatchdayArenaPhaseId,
) {
  switch (phaseId) {
    case "slots":
      return null;
    case "push":
      return row.intensity ? roundArenaScore(row.pushScore ?? 0) : null;
    case "form":
      return row.formCardStatus === "ready" ? roundArenaScore(row.formScore ?? 0) : null;
    case "mutator":
      return row.totalMutatorScore != null ? roundArenaScore(row.totalMutatorScore) : null;
    case "captain":
      return row.captainStatus === "mapped" ? roundArenaScore(row.captainScore ?? 0) : null;
    case "final": {
      const finalDelta = roundArenaScore(row.score - getMatchdayArenaPhaseScore(row, "captain")!);
      return finalDelta != null && Math.abs(finalDelta) >= 0.05 ? finalDelta : null;
    }
    case "result":
      return null;
    default:
      return null;
  }
}

export function getMatchdayArenaPhaseSourceStatus(
  row: MatchdayArenaScoreboardRowView,
  phaseId: MatchdayArenaPhaseId,
) {
  switch (phaseId) {
    case "slots":
      return "source_missing";
    case "push":
      return row.intensity ? "mapped" : "missing_source";
    case "form":
      return row.formCardStatus;
    case "mutator":
      return row.mutator1Label || row.mutator2Label ? "ready" : "missing_source";
    case "captain":
      return row.captainStatus;
    default:
      return "ready";
  }
}

function formatBreakdownValue(value: number | null | undefined, forceSign = false) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }
  const rounded = roundArenaScore(value) ?? 0;
  if (forceSign) {
    if (rounded > 0) {
      return `+${rounded.toFixed(1)}`;
    }
    if (rounded < 0) {
      return rounded.toFixed(1);
    }
    return "0,0";
  }
  return rounded.toFixed(1);
}

export function getMatchdayArenaPhaseBreakdown(
  row: MatchdayArenaScoreboardRowView,
  phaseId: MatchdayArenaPhaseId,
): MatchdayArenaPhaseBreakdownItem[] {
  const phaseOrder: MatchdayArenaPhaseBreakdownItem["id"][] = [
    "slots",
    "push",
    "form",
    "mutator",
    "captain",
  ];

  const maxPhaseIndex =
    phaseId === "result"
      ? phaseOrder.length - 1
      : Math.max(0, phaseOrder.indexOf(phaseId as MatchdayArenaPhaseBreakdownItem["id"]));

  const items: MatchdayArenaPhaseBreakdownItem[] = [
    {
      id: "slots",
      label: "Slots",
      valueLabel: formatBreakdownValue(row.baseScore),
      tone: "neutral",
    },
    {
      id: "push",
      label: "Push",
      valueLabel:
        row.intensity ? formatBreakdownValue(row.pushScore ?? 0, true) : "—",
      tone: (row.pushScore ?? 0) < 0 ? "negative" : (row.pushScore ?? 0) > 0 ? "positive" : "neutral",
    },
    {
      id: "form",
      label: "Form",
      valueLabel:
        row.formCardStatus === "ready" ? formatBreakdownValue(row.formScore ?? 0, true) : "—",
      tone: (row.formScore ?? 0) > 0 ? "positive" : (row.formScore ?? 0) < 0 ? "negative" : "neutral",
    },
    {
      id: "mutator",
      label: "Mut",
      valueLabel:
        row.totalMutatorScore != null ? formatBreakdownValue(row.totalMutatorScore, true) : "—",
      tone:
        (row.totalMutatorScore ?? 0) > 0
          ? "positive"
          : (row.totalMutatorScore ?? 0) < 0
            ? "negative"
            : "neutral",
    },
    {
      id: "captain",
      label: "Cap",
      valueLabel:
        row.captainStatus === "mapped"
          ? formatBreakdownValue(row.captainScore ?? 0, true)
          : "—",
      tone:
        (row.captainScore ?? 0) > 0
          ? "positive"
          : (row.captainScore ?? 0) < 0
            ? "negative"
            : "neutral",
    },
  ];

  return items.filter((item) => phaseOrder.indexOf(item.id) <= maxPhaseIndex);
}
