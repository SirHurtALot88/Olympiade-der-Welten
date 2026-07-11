import type { GameState, LineupDraft, TeamRosterStressRecord } from "@/lib/data/olyDataTypes";
import { deriveRosterTargets } from "@/lib/foundation/roster-limits";
import { normalizeLineupDraftModifiers } from "@/lib/lineups/legacy-lineup-modifiers";
import { getSeasonDisciplineScheduleEntry } from "@/lib/season/season-discipline-schedule";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function rosterCount(gameState: GameState, teamId: string) {
  return gameState.rosters.filter((entry) => entry.teamId === teamId).length;
}

function assessLineupDraftStress(input: {
  draft: LineupDraft;
  gameState: GameState;
  activeRosterCount: number;
}) {
  const scheduleEntry = getSeasonDisciplineScheduleEntry(input.gameState, input.draft.matchdayId, {
    saveId: input.draft.saveId,
  });
  const modifiers = normalizeLineupDraftModifiers(input.draft.modifiers);
  const sides = [
    {
      side: "d1" as const,
      disciplineId: scheduleEntry?.discipline1?.disciplineId ?? null,
      required: scheduleEntry?.discipline1?.playerCount ?? 0,
    },
    {
      side: "d2" as const,
      disciplineId: scheduleEntry?.discipline2?.disciplineId ?? null,
      required: scheduleEntry?.discipline2?.playerCount ?? 0,
    },
  ];

  let slotGaps = 0;
  let requiredTotal = 0;
  for (const side of sides) {
    if (!side.disciplineId || side.required <= 0) continue;
    requiredTotal += side.required;
    const selected = input.draft.entries.filter(
      (entry) => entry.disciplineSide === side.side && entry.disciplineId === side.disciplineId,
    ).length;
    slotGaps += Math.max(0, side.required - selected);
  }

  const rosterLimited = Math.max(0, requiredTotal - input.activeRosterCount);
  const conserveSides = [modifiers.d1, modifiers.d2].filter((side) => side.intensity === "conserve").length;

  return {
    slotGaps,
    rosterLimited,
    conserveSides,
    hasStress: slotGaps > 0 || rosterLimited > 0,
  };
}

export function computeDepthStressScore(input: {
  matchdaysTotal: number;
  matchdaysWithSlotGaps: number;
  matchdaysWithRosterLimited: number;
  conserveSideUses: number;
  endedBelowBaseOpt: boolean;
}) {
  let score = 0;
  if (input.matchdaysTotal > 0) {
    const gapRate = input.matchdaysWithSlotGaps / input.matchdaysTotal;
    const limitedRate = input.matchdaysWithRosterLimited / input.matchdaysTotal;
    if (gapRate >= 0.2) score += 1;
    if (gapRate >= 0.45) score += 1;
    if (limitedRate >= 0.15) score += 1;
    if (input.conserveSideUses >= Math.max(3, Math.ceil(input.matchdaysTotal * 0.25))) score += 1;
  }
  if (input.endedBelowBaseOpt) score += 1;
  return clamp(score, 0, 4);
}

export function resolveOptBumpFromDepthStress(depthStressScore: number) {
  if (depthStressScore >= 3) return 2;
  if (depthStressScore >= 1) return 1;
  return 0;
}

export function buildTeamRosterStressRecord(
  gameState: GameState,
  teamId: string,
  sourceSeasonId: string,
): TeamRosterStressRecord | null {
  const team = gameState.teams.find((entry) => entry.teamId === teamId);
  if (!team) return null;

  const identity = gameState.teamIdentities.find((entry) => entry.teamId === teamId);
  const { playerOpt: basePlayerOpt } = deriveRosterTargets(team, identity);
  const activeRosterCount = rosterCount(gameState, teamId);
  const drafts = (gameState.seasonState.lineupDrafts ?? []).filter(
    (draft) => draft.seasonId === sourceSeasonId && draft.teamId === teamId && draft.entries.length > 0,
  );

  let matchdaysWithSlotGaps = 0;
  let matchdaysWithRosterLimited = 0;
  let conserveSideUses = 0;

  for (const draft of drafts) {
    const assessment = assessLineupDraftStress({ draft, gameState, activeRosterCount });
    if (assessment.slotGaps > 0) matchdaysWithSlotGaps += 1;
    if (assessment.rosterLimited > 0) matchdaysWithRosterLimited += 1;
    conserveSideUses += assessment.conserveSides;
  }

  const endedBelowBaseOpt = activeRosterCount < basePlayerOpt;
  const depthStressScore = computeDepthStressScore({
    matchdaysTotal: drafts.length,
    matchdaysWithSlotGaps,
    matchdaysWithRosterLimited,
    conserveSideUses,
    endedBelowBaseOpt,
  });
  const optBump = resolveOptBumpFromDepthStress(depthStressScore);

  return {
    teamId,
    sourceSeasonId,
    matchdaysTotal: drafts.length,
    matchdaysWithSlotGaps,
    matchdaysWithRosterLimited,
    conserveSideUses,
    endedBelowBaseOpt,
    depthStressScore,
    optBump,
    generatedAt: new Date().toISOString(),
  };
}

export function buildSeasonRosterStressLedger(gameState: GameState, sourceSeasonId: string) {
  const ledger: Record<string, TeamRosterStressRecord> = {};
  for (const team of gameState.teams) {
    const record = buildTeamRosterStressRecord(gameState, team.teamId, sourceSeasonId);
    if (record) {
      ledger[team.teamId] = record;
    }
  }
  return ledger;
}

export function getTeamRosterStressRecord(gameState: GameState, teamId: string) {
  return gameState.seasonState.teamRosterStressByTeamId?.[teamId] ?? null;
}

export function teamHasDepthRepairMandate(gameState: GameState, teamId: string) {
  const stress = getTeamRosterStressRecord(gameState, teamId);
  return Boolean(stress && stress.optBump > 0);
}

export function applySeasonEndRosterStressLedger(gameState: GameState, sourceSeasonId = gameState.season.id): GameState {
  const ledger = buildSeasonRosterStressLedger(gameState, sourceSeasonId);
  return {
    ...gameState,
    seasonState: {
      ...gameState.seasonState,
      teamRosterStressByTeamId: ledger,
    },
  };
}
