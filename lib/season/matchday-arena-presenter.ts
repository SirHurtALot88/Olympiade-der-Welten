import type { MatchdayMvpScoreboardRow } from "@/lib/season/matchday-mvp-scoring-service";

export const MATCHDAY_ARENA_PHASES = [
  { id: "slots", label: "Slots" },
  { id: "push", label: "Intensität" },
  { id: "form", label: "Form" },
  { id: "mutator", label: "Mutator" },
  { id: "captain", label: "Kapitän" },
  { id: "power", label: "Team-Power" },
  { id: "final", label: "Finale" },
  { id: "result", label: "Ergebnis" },
] as const;

export type MatchdayArenaPhaseId = (typeof MATCHDAY_ARENA_PHASES)[number]["id"];

export type MatchdayArenaScoreboardRowView = MatchdayMvpScoreboardRow & {
  baseRank: number;
  rankDelta: number;
  currentScore: number;
  pushScore: number | null;
  formScore: number | null;
  captainScore: number | null;
  teamPowerScore: number | null;
  totalMutatorScore: number | null;
};

export type MatchdayArenaPhaseBreakdownItem = {
  id: "slots" | "push" | "form" | "mutator" | "captain" | "power";
  label: string;
  valueLabel: string;
  tone: "neutral" | "positive" | "negative";
};

export type ArenaScoreTrackSegmentId = MatchdayArenaPhaseBreakdownItem["id"];

export type ArenaScoreTrackSegment = {
  id: ArenaScoreTrackSegmentId;
  label: string;
  value: number;
  tone: "neutral" | "positive" | "negative";
};

export const ARENA_SCORE_TRACK_SEGMENT_LABELS: Record<ArenaScoreTrackSegmentId, string> = {
  slots: "Slots",
  push: "Push",
  form: "Form",
  mutator: "Mutator",
  captain: "Captain",
  power: "Power",
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
    const teamPowerScore =
      row.teamPowerStatus === "ready" ? roundArenaScore(row.teamPowerModifier ?? 0) : null;
    const baseRank = baseRankByTeamId.get(row.teamId) ?? row.rank;

    return {
      ...row,
      baseRank,
      rankDelta: baseRank - row.rank,
      currentScore: roundArenaScore(row.baseScore + (pushScore ?? 0)) ?? row.baseScore,
      pushScore,
      formScore,
      captainScore,
      teamPowerScore,
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
  const powerPhaseScore =
    row.teamPowerStatus === "ready"
      ? captainPhaseScore + (row.teamPowerScore ?? 0)
      : captainPhaseScore;

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
    case "power":
      return roundArenaScore(powerPhaseScore);
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
    case "power":
      return row.teamPowerStatus === "ready" ? roundArenaScore(row.teamPowerScore ?? 0) : null;
    case "final": {
      const finalDelta = roundArenaScore(row.score - getMatchdayArenaPhaseScore(row, "power")!);
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
    case "power":
      return row.teamPowerStatus;
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

export function formatArenaMutatorSelectionLabel(
  row: Pick<MatchdayMvpScoreboardRow, "mutator1Label" | "mutator2Label">,
): string | null {
  const labels = [row.mutator1Label, row.mutator2Label].filter((label): label is string => Boolean(label?.trim()));
  return labels.length > 0 ? labels.join(" · ") : null;
}

function getArenaScoreSegmentTone(value: number): "neutral" | "positive" | "negative" {
  if (value > 0) {
    return "positive";
  }
  if (value < 0) {
    return "negative";
  }
  return "neutral";
}

function getArenaPhaseRevealIndex(phaseId: MatchdayArenaPhaseId) {
  const phaseOrder: ArenaScoreTrackSegmentId[] = ["slots", "push", "form", "mutator", "captain", "power"];
  if (phaseId === "result" || phaseId === "final") {
    return phaseOrder.length - 1;
  }
  const index = phaseOrder.indexOf(phaseId as ArenaScoreTrackSegmentId);
  return index >= 0 ? index : 0;
}

export function buildArenaScoreTrackSegments(
  row: MatchdayArenaScoreboardRowView,
  phaseId: MatchdayArenaPhaseId,
  options?: {
    slotsScore?: number | null;
  },
): ArenaScoreTrackSegment[] {
  const maxPhaseIndex = getArenaPhaseRevealIndex(phaseId);

  if (phaseId === "slots" && options?.slotsScore != null) {
    return [
      {
        id: "slots",
        label: ARENA_SCORE_TRACK_SEGMENT_LABELS.slots,
        value: options.slotsScore,
        tone: getArenaScoreSegmentTone(options.slotsScore),
      },
    ];
  }

  const segments: ArenaScoreTrackSegment[] = [];

  if (maxPhaseIndex >= 0) {
    segments.push({
      id: "slots",
      label: ARENA_SCORE_TRACK_SEGMENT_LABELS.slots,
      value: options?.slotsScore ?? row.baseScore,
      tone: "neutral",
    });
  }
  if (maxPhaseIndex >= 1 && row.intensity) {
    segments.push({
      id: "push",
      label: row.intensity === "push" ? "Push" : row.intensity === "conserve" ? "Schonen" : "Normal",
      value: row.pushScore ?? 0,
      tone: getArenaScoreSegmentTone(row.pushScore ?? 0),
    });
  }
  if (maxPhaseIndex >= 2 && row.formCardStatus === "ready") {
    segments.push({
      id: "form",
      label: ARENA_SCORE_TRACK_SEGMENT_LABELS.form,
      value: row.formScore ?? 0,
      tone: getArenaScoreSegmentTone(row.formScore ?? 0),
    });
  }
  if (maxPhaseIndex >= 3 && row.totalMutatorScore != null) {
    segments.push({
      id: "mutator",
      label: ARENA_SCORE_TRACK_SEGMENT_LABELS.mutator,
      value: row.totalMutatorScore,
      tone: getArenaScoreSegmentTone(row.totalMutatorScore),
    });
  }
  if (maxPhaseIndex >= 4 && row.captainStatus === "mapped") {
    segments.push({
      id: "captain",
      label: ARENA_SCORE_TRACK_SEGMENT_LABELS.captain,
      value: row.captainScore ?? 0,
      tone: getArenaScoreSegmentTone(row.captainScore ?? 0),
    });
  }
  if (maxPhaseIndex >= 5 && row.teamPowerStatus === "ready") {
    segments.push({
      id: "power",
      label: ARENA_SCORE_TRACK_SEGMENT_LABELS.power,
      value: row.teamPowerScore ?? 0,
      tone: getArenaScoreSegmentTone(row.teamPowerScore ?? 0),
    });
  }

  return segments.filter((segment) => Math.abs(segment.value) >= 0.01 || segment.id === "slots");
}

export function countArenaMutatorHitsByTeam(
  teamDetails: Array<{
    teamId: string;
    entries: Array<{
      disciplineSide: "d1" | "d2";
      slotIndex: number;
      mutatorBonus?: number | null;
    }>;
  }>,
  disciplineSide: "d1" | "d2",
  visibleSlotCount = Number.POSITIVE_INFINITY,
) {
  const result = new Map<string, { hits: number; players: number }>();

  for (const team of teamDetails) {
    const sideEntries = team.entries.filter(
      (entry) => entry.disciplineSide === disciplineSide && entry.slotIndex < visibleSlotCount,
    );
    result.set(team.teamId, {
      hits: sideEntries.filter((entry) => (entry.mutatorBonus ?? 0) > 0).length,
      players: sideEntries.length,
    });
  }

  return result;
}

export function getMatchdayArenaPhaseBreakdown(
  row: MatchdayArenaScoreboardRowView,
  phaseId: MatchdayArenaPhaseId,
  options?: {
    mutatorHitCount?: number | null;
  },
): MatchdayArenaPhaseBreakdownItem[] {
  const phaseOrder: MatchdayArenaPhaseBreakdownItem["id"][] = [
    "slots",
    "push",
    "form",
    "mutator",
    "captain",
    "power",
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
      valueLabel: row.intensity
        ? `${row.intensity === "push" ? "Push" : row.intensity === "conserve" ? "Schonen" : "Normal"} ${formatBreakdownValue(row.pushScore ?? 0, true)}`
        : "—",
      tone: (row.pushScore ?? 0) < 0 ? "negative" : (row.pushScore ?? 0) > 0 ? "positive" : "neutral",
    },
    {
      id: "form",
      label: "Form",
      valueLabel:
        row.formCardStatus === "ready"
          ? [formatBreakdownValue(row.formScore ?? 0, true), row.formCardLabel].filter(Boolean).join(" · ")
          : "—",
      tone: (row.formScore ?? 0) > 0 ? "positive" : (row.formScore ?? 0) < 0 ? "negative" : "neutral",
    },
    {
      id: "mutator",
      label: "Mut",
      valueLabel: [
        row.totalMutatorScore != null ? formatBreakdownValue(row.totalMutatorScore, true) : "—",
        formatArenaMutatorSelectionLabel(row),
        options?.mutatorHitCount != null ? `${options.mutatorHitCount} Treffer` : null,
      ]
        .filter(Boolean)
        .join(" · "),
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
    {
      id: "power",
      label: "Pow",
      valueLabel:
        row.teamPowerStatus === "ready"
          ? [
              row.teamPowerModifier != null && row.teamPowerModifier !== 0
                ? formatBreakdownValue(row.teamPowerScore ?? 0, true)
                : row.teamPowerImpact != null && row.teamPowerImpact > 0
                  ? `${row.teamPowerImpact.toFixed(1)}%`
                  : formatBreakdownValue(row.teamPowerScore ?? 0, true),
              row.teamPowerLabel,
            ]
              .filter(Boolean)
              .join(" · ")
          : "—",
      tone:
        (row.teamPowerScore ?? 0) > 0
          ? "positive"
          : (row.teamPowerScore ?? 0) < 0
            ? "negative"
            : row.teamPowerImpact != null && row.teamPowerImpact > 0
              ? "positive"
              : "neutral",
    },
  ];

  return items.filter((item) => phaseOrder.indexOf(item.id) <= maxPhaseIndex);
}

export type ArenaRevealStep = {
  phaseId: MatchdayArenaPhaseId;
  revealedSlotCount: number;
};

export type ArenaResolveTeamEntry = {
  disciplineSide: "d1" | "d2";
  slotIndex: number;
  playerId: string;
  baseScore: number | null;
  mutatorBonus?: number | null;
};

export type ArenaResolveTeamDetail = {
  teamId: string;
  entries: ArenaResolveTeamEntry[];
};

export type ArenaPlayerRankCandidate = {
  playerId: string;
  teamId: string;
  slotIndex: number;
  baseScore: number | null;
  mutatorBonus: number | null;
};

export type ArenaPlayerRankSnapshot = {
  rankInSlotBase: number | null;
  rankTotalBase: number | null;
  rankInSlotBoosted: number | null;
  rankTotalBoosted: number | null;
};

export function getPreviousArenaRevealStep(
  step: ArenaRevealStep,
  maxSlotRevealCount: number,
): ArenaRevealStep | null {
  if (step.phaseId === "slots") {
    if (step.revealedSlotCount > 0) {
      return { phaseId: "slots", revealedSlotCount: step.revealedSlotCount - 1 };
    }
    return null;
  }

  const phaseIndex = MATCHDAY_ARENA_PHASES.findIndex((phase) => phase.id === step.phaseId);
  if (phaseIndex <= 0) {
    return null;
  }

  const previousPhase = MATCHDAY_ARENA_PHASES[phaseIndex - 1];
  if (previousPhase.id === "slots") {
    return { phaseId: "slots", revealedSlotCount: maxSlotRevealCount };
  }

  return {
    phaseId: previousPhase.id,
    revealedSlotCount: maxSlotRevealCount,
  };
}

export function buildArenaSlotScoreByTeamId(
  teamDetails: ArenaResolveTeamDetail[],
  disciplineSide: "d1" | "d2",
  revealedSlotCount: number,
) {
  const scoreByTeamId = new Map<string, number>();

  for (const team of teamDetails) {
    let cumulativeScore = 0;
    for (const entry of team.entries) {
      if (entry.disciplineSide !== disciplineSide || entry.slotIndex >= revealedSlotCount) {
        continue;
      }
      cumulativeScore += entry.baseScore ?? 0;
    }
    scoreByTeamId.set(team.teamId, Number(cumulativeScore.toFixed(1)));
  }

  return scoreByTeamId;
}

export function getArenaTeamScoreAtRevealStep(
  row: MatchdayArenaScoreboardRowView,
  step: ArenaRevealStep,
  slotScoresAtCount: (count: number) => Map<string, number>,
) {
  if (step.phaseId === "slots") {
    return slotScoresAtCount(step.revealedSlotCount).get(row.teamId) ?? 0;
  }
  return getMatchdayArenaPhaseScore(row, step.phaseId) ?? 0;
}

export function buildArenaTeamRankMap(
  rows: MatchdayArenaScoreboardRowView[],
  step: ArenaRevealStep,
  slotScoresAtCount: (count: number) => Map<string, number>,
) {
  const ranked = [...rows].sort((left, right) => {
    const leftScore = getArenaTeamScoreAtRevealStep(left, step, slotScoresAtCount);
    const rightScore = getArenaTeamScoreAtRevealStep(right, step, slotScoresAtCount);
    if (rightScore !== leftScore) {
      return rightScore - leftScore;
    }
    return left.teamName.localeCompare(right.teamName, "de");
  });

  return new Map(ranked.map((row, index) => [row.teamId, index + 1] as const));
}

export function getArenaStepRankDelta(
  currentRank: number | null | undefined,
  previousRank: number | null | undefined,
) {
  if (
    currentRank == null ||
    previousRank == null ||
    !Number.isFinite(currentRank) ||
    !Number.isFinite(previousRank)
  ) {
    return null;
  }
  return previousRank - currentRank;
}

export function formatArenaRankDelta(delta: number | null | undefined) {
  if (delta == null || !Number.isFinite(delta) || delta === 0) {
    return null;
  }
  return delta > 0 ? `+${delta}` : `${delta}`;
}

function buildArenaPlayerRankMap(
  candidates: ArenaPlayerRankCandidate[],
  getScore: (candidate: ArenaPlayerRankCandidate) => number,
  slotIndex?: number,
) {
  const pool = candidates.filter((candidate) => {
    if (candidate.baseScore == null || !Number.isFinite(candidate.baseScore)) {
      return false;
    }
    return slotIndex == null ? true : candidate.slotIndex === slotIndex;
  });

  const sorted = [...pool].sort((left, right) => {
    const scoreDelta = getScore(right) - getScore(left);
    if (scoreDelta !== 0) {
      return scoreDelta;
    }
    return left.playerId.localeCompare(right.playerId, "de");
  });

  const rankMap = new Map<string, number>();
  for (const [index, candidate] of sorted.entries()) {
    rankMap.set(`${candidate.playerId}::${candidate.slotIndex}`, index + 1);
  }
  return rankMap;
}

function computeArenaPlayerBoostedScore(
  candidate: ArenaPlayerRankCandidate,
  teamBaseTotal: number,
  formModifier: number | null | undefined,
  includeFormBonus: boolean,
  includeMutatorBonus: boolean,
) {
  const baseScore = candidate.baseScore ?? 0;
  let score = baseScore;
  if (includeMutatorBonus) {
    score += candidate.mutatorBonus ?? 0;
  }
  if (includeFormBonus && formModifier != null && Number.isFinite(formModifier) && teamBaseTotal > 0) {
    score += (baseScore / teamBaseTotal) * formModifier;
  }
  return Number(score.toFixed(1));
}

export function buildArenaPlayerRankLookup(input: {
  candidates: ArenaPlayerRankCandidate[];
  formModifierByTeamId: Map<string, number | null>;
  includeFormBonus: boolean;
  includeMutatorBonus: boolean;
}) {
  const validCandidates = input.candidates.filter(
    (candidate) => candidate.baseScore != null && Number.isFinite(candidate.baseScore),
  );
  const teamBaseTotals = new Map<string, number>();
  for (const candidate of validCandidates) {
    teamBaseTotals.set(
      candidate.teamId,
      (teamBaseTotals.get(candidate.teamId) ?? 0) + (candidate.baseScore ?? 0),
    );
  }

  const rankTotalBase = buildArenaPlayerRankMap(validCandidates, (candidate) => candidate.baseScore ?? 0);
  const rankTotalBoosted = buildArenaPlayerRankMap(validCandidates, (candidate) =>
    computeArenaPlayerBoostedScore(
      candidate,
      teamBaseTotals.get(candidate.teamId) ?? 0,
      input.formModifierByTeamId.get(candidate.teamId),
      input.includeFormBonus,
      input.includeMutatorBonus,
    ),
  );

  const rankInSlotBaseByKey = new Map<string, number>();
  const rankInSlotBoostedByKey = new Map<string, number>();
  for (const slotIndex of new Set(validCandidates.map((candidate) => candidate.slotIndex))) {
    for (const [key, rank] of buildArenaPlayerRankMap(
      validCandidates,
      (candidate) => candidate.baseScore ?? 0,
      slotIndex,
    )) {
      rankInSlotBaseByKey.set(key, rank);
    }
    for (const [key, rank] of buildArenaPlayerRankMap(
      validCandidates,
      (candidate) =>
        computeArenaPlayerBoostedScore(
          candidate,
          teamBaseTotals.get(candidate.teamId) ?? 0,
          input.formModifierByTeamId.get(candidate.teamId),
          input.includeFormBonus,
          input.includeMutatorBonus,
        ),
      slotIndex,
    )) {
      rankInSlotBoostedByKey.set(key, rank);
    }
  }

  const lookup = new Map<string, ArenaPlayerRankSnapshot>();
  for (const candidate of validCandidates) {
    const key = `${candidate.playerId}::${candidate.slotIndex}`;
    lookup.set(key, {
      rankInSlotBase: rankInSlotBaseByKey.get(key) ?? null,
      rankTotalBase: rankTotalBase.get(key) ?? null,
      rankInSlotBoosted: rankInSlotBoostedByKey.get(key) ?? null,
      rankTotalBoosted: rankTotalBoosted.get(key) ?? null,
    });
  }
  return lookup;
}
