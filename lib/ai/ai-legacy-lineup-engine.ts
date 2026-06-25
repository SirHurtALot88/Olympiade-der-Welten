import type {
  AiCaptainSelectionStatus,
  AiLegacyLineupPreview,
  AiLegacyLineupPreviewStatus,
  AiLegacyLineupSelectedPlayer,
  AiLegacyLineupSuggestion,
  AiLegacyLineupSuggestionSide,
  AiNeedAxis,
  AiSideSelectionReason,
} from "@/lib/ai/ai-needs-types";
import type { DisciplineCategory } from "@/lib/data/olyDataTypes";
import { evaluateLegacyAiNeeds } from "@/lib/ai/ai-needs-engine";
import { deriveTeamIdentityAxisWeightMap } from "@/lib/foundation/team-identity-settings";
import { buildLegacyLineupAggregateScore } from "@/lib/lineups/legacy-score-engine";
import { scoreLegacyLineupDisciplineSide } from "@/lib/lineups/legacy-score-engine";
import { calculateMatchdayProjectedPreview, resolveSlotRolesForDiscipline } from "@/lib/lineups/matchday-slot-roles";
import type { DisciplineSide, LegacyLineupEntryInput, LegacyLineupLoadedContext } from "@/lib/lineups/legacy-lineup-types";
import { validateLegacyLineupContext } from "@/lib/lineups/legacy-lineup-validator";
import { buildLineupPlayerDemandMap } from "@/lib/morale/player-demands-service";

type CaptainSuggestionCandidate = {
  disciplineId: string;
  disciplineSide: DisciplineSide;
  activePlayerId: string;
  playerId: string;
  captainName: string | null;
  estimatedContribution: number;
  warnings: string[];
};

type CaptainDecision = {
  candidate: CaptainSuggestionCandidate | null;
  status: AiCaptainSelectionStatus;
  warnings: string[];
};

function formatAiReasonScore(value: number | null | undefined, digits = 1) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }
  return value.toFixed(digits).replace(/\\.0$/, "");
}

function formatCaptainReasonToken(value: string) {
  const labels: Record<string, string> = {
    front_defense: "Toprang verteidigen",
    podium_attack: "Podium angreifen",
    top10_pressure: "Top-10-Druck",
    rank_climb_window: "Rank-Fenster",
    outside_push_window: "Aufholfenster",
    large_discipline_leverage: "große Diszi absichern",
    captain_budget_pressure: "Captain-Budget nutzen",
    specialist_upset_95: "Elite-Upset in kleiner Diszi",
    specialist_upset_90: "Elite-Spezialist in kleiner Diszi",
    specialist_upset_85: "starker Spezialist in kleiner Diszi",
    specialist_upset_80: "Upset-Chance in kleiner Diszi",
    huge_bonus: "sehr hoher Captain-Bonus",
    strong_bonus: "starker Captain-Bonus",
    late_season: "späte Saison",
    season_pressure: "Saisondruck",
  };
  return labels[value] ?? value;
}

function buildAiLineupDemandMap(context: LegacyLineupLoadedContext) {
  const disciplineScoresByPlayerId = new Map<string, Record<string, number>>();
  for (const score of context.disciplineScores) {
    const ratings = disciplineScoresByPlayerId.get(score.playerId) ?? {};
    ratings[score.disciplineId] = score.score;
    disciplineScoresByPlayerId.set(score.playerId, ratings);
  }

  const matchdayDisciplines = [context.matchdayContract?.discipline1, context.matchdayContract?.discipline2]
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    .map((entry) => ({
      id: entry.disciplineId,
      name: entry.displayName,
      category: entry.category as DisciplineCategory,
      playerCount: entry.requiredPlayers,
    }));

  return buildLineupPlayerDemandMap({
    seasonId: context.seasonId,
    teamId: context.teamId,
    rosterPlayers: context.rosterPlayers.map((player) => ({
      id: player.id,
      name: player.name,
      traitsPositive: player.traitsPositive ?? [],
      traitsNegative: player.traitsNegative ?? [],
      disciplineRatings: disciplineScoresByPlayerId.get(player.id) ?? {},
      coreStats: player.coreStats,
      attributeSheetStats: player.attributeStats ?? undefined,
      pps: player.pps ?? null,
      ovr: player.ovr ?? null,
    })),
    matchdayDisciplines,
  });
}

function getLineupDemandScore(input: {
  context: LegacyLineupLoadedContext;
  demandMap: ReturnType<typeof buildAiLineupDemandMap>;
  playerId: string;
  disciplineId: string;
  captainIntent?: boolean;
}) {
  const demands = input.demandMap.get(input.playerId) ?? [];
  let bonus = 0;
  const reasons: string[] = [];
  for (const demand of demands) {
    if (demand.status === "fulfilled" || demand.status === "failed") continue;
    const priorityBonus = demand.priority === "high" ? 3.5 : demand.priority === "medium" ? 2 : 1;
    if (demand.type === "discipline_start" && demand.targetDisciplineId === input.disciplineId) {
      bonus += priorityBonus;
      reasons.push(`Forderung ${demand.label} +${priorityBonus}`);
    } else if (demand.type === "appearances") {
      bonus += Math.max(0.5, priorityBonus * 0.5);
      reasons.push(`Einsatzforderung +${Math.max(0.5, priorityBonus * 0.5)}`);
    } else if (input.captainIntent && demand.type === "captaincy" && (!demand.targetDisciplineId || demand.targetDisciplineId === input.disciplineId)) {
      bonus += priorityBonus;
      reasons.push(`Captain-Forderung +${priorityBonus}`);
    }
  }
  return {
    bonus,
    reasons,
  };
}

function getIdentityTieBreakScore(
  context: LegacyLineupLoadedContext,
  playerId: string,
  focusAxes: AiNeedAxis[],
) {
  const player = context.rosterPlayers.find((entry) => entry.id === playerId);
  if (!player) {
    return 0;
  }

  const identity = deriveTeamIdentityAxisWeightMap(context.teamIdentity);
  const axisScores = {
    pow: player.coreStats.pow * identity.pow,
    spe: player.coreStats.spe * identity.spe,
    men: player.coreStats.men * identity.men,
    soc: player.coreStats.soc * identity.soc,
  };

  if (focusAxes.length === 0) {
    return axisScores.pow + axisScores.spe + axisScores.men + axisScores.soc;
  }

  return focusAxes.reduce((sum, axis) => sum + axisScores[axis], 0);
}

function buildEntriesForDisciplineSide(
  context: LegacyLineupLoadedContext,
  disciplineId: string | null,
  disciplineSide: DisciplineSide,
  usedPlayerIds: Set<string>,
  focusAxes: AiNeedAxis[],
): { entries: LegacyLineupEntryInput[]; warnings: string[]; reasoning: string[]; selectionReasons: AiSideSelectionReason[] } {
  if (!disciplineId) {
    return {
      entries: [],
      warnings: [`No discipline configured for ${disciplineSide}.`],
      reasoning: [],
      selectionReasons: [],
    };
  }

  const demandMap = buildAiLineupDemandMap(context);
  const playerCount = context.disciplinePlayerCounts[disciplineId] ?? 0;
  const slotRoles = resolveSlotRolesForDiscipline(disciplineId, disciplineId, playerCount);
  const rosterById = new Map((context.rosterPlayers ?? []).map((player) => [player.id, player]));
  const picked: Array<{
    activePlayerId: string;
    playerId: string;
    score: number;
    demandBonus: number;
    demandReasons: string[];
    hasScore: boolean;
    tieBreak: number;
    slotFitBonus: number;
    slotIndex: number;
  }> = [];

  for (let slotIndex = 0; slotIndex < playerCount; slotIndex += 1) {
    const role = slotRoles[slotIndex] ?? null;
    const candidates = context.activePlayers
      .filter((player) => !usedPlayerIds.has(player.playerId))
      .map((player) => {
        const disciplineScore = context.disciplineScores.find(
          (entry) => entry.playerId === player.playerId && entry.disciplineId === disciplineId,
        );
        const score = disciplineScore?.score ?? Number.NEGATIVE_INFINITY;
        const tieBreak = getIdentityTieBreakScore(context, player.playerId, focusAxes);
        const demand = getLineupDemandScore({ context, demandMap, playerId: player.playerId, disciplineId });
        const rosterPlayer = rosterById.get(player.playerId) ?? null;
        const slotFitBonus =
          disciplineScore?.score != null
            ? calculateMatchdayProjectedPreview({
                baseScore: disciplineScore.score,
                role,
                attributeStats: rosterPlayer?.attributeStats ?? null,
                currentFatigueCount: context.fatigueByPlayerId?.[player.playerId]?.count ?? 0,
                requiredPlayers: playerCount,
                intensity: "normal",
              }).roleModifier
            : 0;

        return {
          activePlayerId: player.id,
          playerId: player.playerId,
          score,
          demandBonus: demand.bonus,
          demandReasons: demand.reasons,
          hasScore: disciplineScore != null,
          tieBreak,
          slotFitBonus,
          slotIndex,
        };
      })
      .sort((left, right) => {
        if (left.hasScore !== right.hasScore) {
          return left.hasScore ? -1 : 1;
        }
        const leftEffectiveScore = left.score + left.demandBonus + left.slotFitBonus;
        const rightEffectiveScore = right.score + right.demandBonus + right.slotFitBonus;
        if (rightEffectiveScore !== leftEffectiveScore) {
          return rightEffectiveScore - leftEffectiveScore;
        }
        if (right.tieBreak !== left.tieBreak) {
          return right.tieBreak - left.tieBreak;
        }
        return left.playerId.localeCompare(right.playerId);
      });

    const selected = candidates[0];
    if (!selected) {
      break;
    }
    picked.push(selected);
    usedPlayerIds.add(selected.playerId);
  }

  return {
    entries: picked.map((player) => ({
      disciplineId,
      disciplineSide,
      slotIndex: player.slotIndex,
      playerId: player.playerId,
      activePlayerId: player.activePlayerId,
    })),
    warnings: [
      ...(picked.length < playerCount ? [`Only ${picked.length}/${playerCount} players available for ${disciplineId} ${disciplineSide}.`] : []),
      ...picked
        .filter((player) => !player.hasScore)
        .map((player) => `Missing discipline score for player ${player.playerId} in ${disciplineId} (${disciplineSide}).`),
    ],
    reasoning: picked.map((player) => {
      return `${disciplineSide.toUpperCase()} Slot ${player.slotIndex + 1}: Score ${formatAiReasonScore(player.hasScore ? player.score : null)} + Bedarf ${formatAiReasonScore(player.demandBonus)} + Slot-Fit ${formatAiReasonScore(player.slotFitBonus)} + Teamfit ${formatAiReasonScore(player.tieBreak)}${player.demandReasons.length ? ` (${player.demandReasons.join(", ")})` : ""}`;
    }),
    selectionReasons: picked.map((player) => {
      const disciplineScore = player.hasScore ? player.score : null;
      const selectionScore = disciplineScore == null ? null : disciplineScore + player.demandBonus + player.slotFitBonus;
      const demandText = player.demandReasons.length > 0
        ? `, dazu ${player.demandReasons.join(", ")}`
        : "";
      return {
        playerId: player.playerId,
        activePlayerId: player.activePlayerId,
        slotIndex: player.slotIndex,
        disciplineScore,
        selectionScore,
        demandBonus: player.demandBonus,
        identityTieBreak: player.tieBreak,
        demandReasons: player.demandReasons,
        reason: `Eingesetzt wegen ${formatAiReasonScore(disciplineScore)} Diszi-Score, Slot-Fit ${formatAiReasonScore(player.slotFitBonus)}${demandText}. Teamfit/Tiebreak ${formatAiReasonScore(player.tieBreak)}.`,
      };
    }),
  };
}

export function buildAiLegacyLineupSuggestion(context: LegacyLineupLoadedContext): AiLegacyLineupSuggestion {
  const needsSummary = evaluateLegacyAiNeeds(context);
  const usedPlayerIds = new Set<string>();

  const d1 = buildEntriesForDisciplineSide(
    context,
    needsSummary.d1NeedSummary.disciplineId,
    "d1",
    usedPlayerIds,
    needsSummary.d1NeedSummary.focusAxes,
  );
  const d2 = buildEntriesForDisciplineSide(
    context,
    needsSummary.d2NeedSummary.disciplineId,
    "d2",
    usedPlayerIds,
    needsSummary.d2NeedSummary.focusAxes,
  );

  const entries = [...d1.entries, ...d2.entries];
  const validation = validateLegacyLineupContext({
    ...context,
    entries,
    disciplineSidePlayerCounts: {
      ...(needsSummary.d1NeedSummary.disciplineId
        ? { [`${needsSummary.d1NeedSummary.disciplineId}::d1`]: needsSummary.d1NeedSummary.playerCount }
        : {}),
      ...(needsSummary.d2NeedSummary.disciplineId
        ? { [`${needsSummary.d2NeedSummary.disciplineId}::d2`]: needsSummary.d2NeedSummary.playerCount }
        : {}),
    },
  });

  const scoreD1 = needsSummary.d1NeedSummary.disciplineId
    ? scoreLegacyLineupDisciplineSide({
        disciplineId: needsSummary.d1NeedSummary.disciplineId,
        disciplineSide: "d1",
        entries,
        disciplineScores: context.disciplineScores,
      })
    : { entries: [], totalScore: 0, missingScores: [], validationWarnings: [] };
  const scoreD2 = needsSummary.d2NeedSummary.disciplineId
    ? scoreLegacyLineupDisciplineSide({
        disciplineId: needsSummary.d2NeedSummary.disciplineId,
        disciplineSide: "d2",
        entries,
        disciplineScores: context.disciplineScores,
      })
    : { entries: [], totalScore: 0, missingScores: [], validationWarnings: [] };

  return {
    entries,
    scorePreview: {
      entries: [...scoreD1.entries, ...scoreD2.entries],
      totalScore: scoreD1.totalScore + scoreD2.totalScore,
      missingScores: [...scoreD1.missingScores, ...scoreD2.missingScores],
      validationWarnings: [...validation.warnings, ...scoreD1.validationWarnings, ...scoreD2.validationWarnings],
    },
    needsSummary,
    warnings: [...needsSummary.warnings, ...d1.warnings, ...d2.warnings, ...validation.errors],
    debugReasoning: [...d1.reasoning, ...d2.reasoning],
    d1SelectionReasons: d1.selectionReasons,
    d2SelectionReasons: d2.selectionReasons,
  };
}

function getDisciplineName(context: LegacyLineupLoadedContext, disciplineId: string | null) {
  if (!disciplineId) {
    return null;
  }
  return (
    context.matchdayContract?.discipline1?.disciplineId === disciplineId
      ? context.matchdayContract.discipline1.displayName
      : context.matchdayContract?.discipline2?.disciplineId === disciplineId
        ? context.matchdayContract.discipline2.displayName
        : context.disciplines.find((entry) => entry.id === disciplineId)?.name ?? null
  );
}

function getSideStatus(input: {
  disciplineId: string | null;
  selectedPlayers: number;
  requiredPlayers: number;
  missingScores: string[];
  warnings: string[];
}) : AiLegacyLineupPreviewStatus {
  if (!input.disciplineId) {
    return "blocked";
  }
  if (input.missingScores.length > 0) {
    return "missing_scores";
  }
  if (input.selectedPlayers < input.requiredPlayers || input.warnings.length > 0) {
    return "incomplete_roster";
  }
  return "ready";
}

function getPreviewStatus(
  d1: AiLegacyLineupSuggestionSide,
  d2: AiLegacyLineupSuggestionSide,
  warnings: string[],
): AiLegacyLineupPreviewStatus {
  if (d1.status === "blocked" || d2.status === "blocked") {
    return "blocked";
  }
  if (d1.status === "missing_scores" || d2.status === "missing_scores") {
    return "missing_scores";
  }
  if (
    d1.status === "incomplete_roster" ||
    d2.status === "incomplete_roster" ||
    warnings.some((warning) => warning.toLowerCase().includes("only ")) ||
    warnings.some((warning) => warning.toLowerCase().includes("kein captain")) ||
    warnings.some((warning) => warning.toLowerCase().includes("keine disziplin"))
  ) {
    return "incomplete_roster";
  }
  return "ready";
}

function buildSideExplanation(
  disciplineName: string | null,
  selectedPlayers: number,
  requiredPlayers: number,
  captainName: string | null,
  fatigueWarnings: string[],
  sideWarnings: string[],
) {
  const label = disciplineName ?? "Unbekannte Disziplin";
  const parts = [
    `${label}: ${selectedPlayers}/${requiredPlayers} Spieler`,
    captainName ? `Captain ${captainName}` : "kein Captain",
  ];
  if (fatigueWarnings.length > 0) {
    parts.push(`${fatigueWarnings.length} Fatigue-Hinweise`);
  }
  if (sideWarnings.length > 0) {
    parts.push(`${sideWarnings.length} Warnings`);
  }
  return parts.join(" · ");
}

function buildStrategyProfileExplanation(context: LegacyLineupLoadedContext) {
  const profile = context.teamStrategyProfile;
  if (!profile) {
    return null;
  }

  const tags = [
    profile.rosterStyle,
    profile.buyStyle,
    profile.preferredArchetypes[0] ? `Prefers ${profile.preferredArchetypes[0]}` : null,
    profile.hardNoGos[0] ? `No-go: ${profile.hardNoGos[0]}` : null,
  ].filter((entry): entry is string => Boolean(entry));

  return `${profile.strategySummary}${tags.length > 0 ? ` · ${tags.slice(0, 3).join(" · ")}` : ""}`;
}

function suggestCaptainForSide(
  context: LegacyLineupLoadedContext,
  entries: Array<LegacyLineupEntryInput & { isCaptain: boolean }>,
  disciplineId: string | null,
  disciplineSide: DisciplineSide,
): CaptainSuggestionCandidate | null {
  if (!disciplineId) {
    return null;
  }

  const sideEntries = entries.filter((entry) => entry.disciplineId === disciplineId && entry.disciplineSide === disciplineSide);
  if (sideEntries.length === 0) {
    return null;
  }

  const scorePreview = scoreLegacyLineupDisciplineSide({
    disciplineId,
    disciplineSide,
    entries: sideEntries,
    disciplineScores: context.disciplineScores,
    activePlayers: context.activePlayers,
    rosterPlayers: context.rosterPlayers,
    requiredPlayers:
      context.disciplineSidePlayerCounts?.[`${disciplineId}::${disciplineSide}`] ??
      context.disciplinePlayerCounts[disciplineId] ??
      null,
    fatigueByPlayerId: context.fatigueByPlayerId ?? null,
    fatigueSourceStatus: context.fatigueSourceStatus ?? "missing_source",
    formCardsAvailable: null,
    formCardsSelected: null,
    formModifier: null,
    mutatorText: null,
    mutatorModifier: null,
  });

  const bestEntry =
    [...scorePreview.entries]
      .filter((entry) => entry.finalContribution != null)
      .sort((left, right) => {
        const demandMap = buildAiLineupDemandMap(context);
        const leftDemand = getLineupDemandScore({ context, demandMap, playerId: left.playerId, disciplineId, captainIntent: true }).bonus;
        const rightDemand = getLineupDemandScore({ context, demandMap, playerId: right.playerId, disciplineId, captainIntent: true }).bonus;
        return ((right.finalContribution ?? 0) + rightDemand) - ((left.finalContribution ?? 0) + leftDemand);
      })[0] ?? null;

  if (!bestEntry) {
    return {
      disciplineId,
      disciplineSide,
      activePlayerId: sideEntries[0]!.activePlayerId!,
      playerId: sideEntries[0]!.playerId,
      captainName: null,
      estimatedContribution: Number.NEGATIVE_INFINITY,
      warnings: [`Captain-Vorschlag fuer ${disciplineId}/${disciplineSide} konnte nicht berechnet werden.`],
    };
  }

  return {
    disciplineId,
    disciplineSide,
    activePlayerId: bestEntry.activePlayerId ?? sideEntries[0]!.activePlayerId!,
    playerId: bestEntry.playerId,
    captainName: bestEntry.name ?? null,
    estimatedContribution: bestEntry.finalContribution ?? Number.NEGATIVE_INFINITY,
    warnings: [],
  };
}

function applyCaptainDecisions(
  entries: Array<LegacyLineupEntryInput & { isCaptain: boolean }>,
  decisions: CaptainDecision[],
) {
  const selectedKeys = new Set(
    decisions
      .filter((decision) => decision.status === "selected" && decision.candidate)
      .map((decision) => `${decision.candidate!.disciplineId}::${decision.candidate!.disciplineSide}::${decision.candidate!.playerId}::${decision.candidate!.activePlayerId}`),
  );

  return entries.map((entry) => {
    const key = `${entry.disciplineId}::${entry.disciplineSide}::${entry.playerId}::${entry.activePlayerId ?? ""}`;
    const sameSide = decisions.some(
      (decision) => decision.candidate?.disciplineId === entry.disciplineId && decision.candidate?.disciplineSide === entry.disciplineSide,
    );

    if (!sameSide) {
      return entry;
    }

    return {
      ...entry,
      isCaptain: selectedKeys.has(key),
    };
  });
}

function getCaptainUsageBeforeCurrentDraft(context: LegacyLineupLoadedContext) {
  const previousCaptainKeys = new Set(
    (context.existingDraft?.entries ?? [])
      .filter((entry) => entry.isCaptain)
      .map((entry) => `${entry.disciplineId}::${entry.disciplineSide}`),
  );
  const exactCaptainUsedSideKeys = Array.isArray(context.teamStatus?.captainUsedSides)
    ? new Set(context.teamStatus.captainUsedSides)
    : null;

  if (exactCaptainUsedSideKeys) {
    for (const key of previousCaptainKeys) {
      exactCaptainUsedSideKeys.delete(key);
    }

    return {
      count: exactCaptainUsedSideKeys.size,
      sideKeys: exactCaptainUsedSideKeys,
      hasExactSideKeys: true,
    };
  }

  return {
    count: Math.max(0, (context.teamStatus?.captainUsedCount ?? 0) - previousCaptainKeys.size),
    sideKeys: new Set<string>(),
    hasExactSideKeys: false,
  };
}

function evaluateAiCaptainOpportunity(
  context: LegacyLineupLoadedContext,
  captainSlotsRemaining: number,
  candidate: CaptainSuggestionCandidate,
) {
  const rank = context.teamDisciplineRanks?.[candidate.disciplineId]?.rank ?? null;
  const requiredPlayers =
    context.disciplineSidePlayerCounts?.[`${candidate.disciplineId}::${candidate.disciplineSide}`] ??
    context.disciplinePlayerCounts[candidate.disciplineId] ??
    0;
  const contribution = Number.isFinite(candidate.estimatedContribution) ? candidate.estimatedContribution : 0;
  const captainBonusEstimate = contribution * 0.5;
  const totalMatchdays = Math.max(1, Math.ceil((context.matchdayContract?.totalDisciplineSidesInSeason ?? 20) / 2));
  const matchdayIndex = Math.max(1, context.matchdayContract?.matchdayIndex ?? context.matchday.index ?? 1);
  const remainingMatchdaysIncludingCurrent = Math.max(1, totalMatchdays - matchdayIndex + 1);
  const earlySeason = matchdayIndex <= Math.ceil(totalMatchdays * 0.3);
  const midSeason = matchdayIndex <= Math.ceil(totalMatchdays * 0.65);
  let score = 0;
  const reasons: string[] = [];

  if (rank != null) {
    if (rank <= 3) {
      score += 5;
      reasons.push("front_defense");
    } else if (rank <= 6) {
      score += 4;
      reasons.push("podium_attack");
    } else if (rank <= 10) {
      score += 3;
      reasons.push("top10_pressure");
    } else if (rank <= 16) {
      score += 2;
      reasons.push("rank_climb_window");
    } else if (rank <= 24) {
      score += 1;
      reasons.push("outside_push_window");
    }
  }

  if (requiredPlayers >= 5 && (rank == null || rank <= 18)) {
    score += 2;
    reasons.push("large_discipline_leverage");
  }
  if (requiredPlayers >= 5 && rank != null && rank > 18 && contribution >= 88) {
    score += 1;
    reasons.push("large_discipline_leverage");
  }

  if (requiredPlayers <= 3 && contribution >= 95) {
    score += 8;
    reasons.push("specialist_upset_95");
  } else if (requiredPlayers <= 3 && contribution >= 90) {
    score += 6;
    reasons.push("specialist_upset_90");
  } else if (requiredPlayers <= 3 && contribution >= 85) {
    score += 4;
    reasons.push("specialist_upset_85");
  } else if (requiredPlayers <= 3 && contribution >= 80) {
    score += 3;
    reasons.push("specialist_upset_80");
  }

  if (captainBonusEstimate >= 45) {
    score += 2;
    reasons.push("huge_bonus");
  } else if (captainBonusEstimate >= 35) {
    score += 1;
    reasons.push("strong_bonus");
  }

  if (matchdayIndex >= totalMatchdays - 1) {
    score += 2;
    reasons.push("late_season");
  } else if (matchdayIndex >= Math.ceil(totalMatchdays * 0.6)) {
    score += 1;
    reasons.push("season_pressure");
  }

  if (captainSlotsRemaining >= remainingMatchdaysIncludingCurrent) {
    score += 2;
    reasons.push("captain_budget_pressure");
  } else if (captainSlotsRemaining > remainingMatchdaysIncludingCurrent / 2) {
    score += 1;
    reasons.push("captain_budget_pressure");
  }

  const threshold =
    earlySeason
      ? 9
      : midSeason
        ? 8
        : 6;
  const hasEliteSpecialistCase = requiredPlayers <= 3 && contribution >= 95;
  const hasTopSixLargeDisciplineCase =
    !earlySeason && rank != null && rank <= 6 && requiredPlayers >= 5 && captainBonusEstimate >= 32;
  const hasTopTenLateCase =
    !midSeason && rank != null && rank <= 10 && captainBonusEstimate >= 30;
  const hasClearCaptainCase =
    score >= threshold + 1 ||
    hasEliteSpecialistCase ||
    hasTopSixLargeDisciplineCase ||
    hasTopTenLateCase ||
    (!earlySeason && rank != null && rank <= 3 && captainBonusEstimate >= 40);

  return {
    score,
    threshold,
    isWorthUsing: captainSlotsRemaining > 0 && score >= threshold && hasClearCaptainCase,
    isEliteWindow: score >= threshold + 4,
    reasons,
  };
}

function getAiCaptainNewSlotBudget(
  context: LegacyLineupLoadedContext,
  captainSlotsRemaining: number,
  captainOpportunities: Array<ReturnType<typeof evaluateAiCaptainOpportunity>>,
) {
  if (captainSlotsRemaining <= 0) {
    return 0;
  }

  const worthUsingCount = captainOpportunities.filter((entry) => entry.isWorthUsing).length;
  if (worthUsingCount <= 0) {
    return 0;
  }

  const matchdayIndex = Math.max(1, context.matchdayContract?.matchdayIndex ?? context.matchday.index ?? 1);
  const totalMatchdays = Math.max(1, Math.ceil((context.matchdayContract?.totalDisciplineSidesInSeason ?? 20) / 2));
  const eliteWindowCount = captainOpportunities.filter((entry) => entry.isEliteWindow).length;
  const lateSeason = matchdayIndex >= Math.max(1, totalMatchdays - 2);
  const canDoubleCommit =
    captainSlotsRemaining >= 2 &&
    worthUsingCount >= 2 &&
    (lateSeason || (eliteWindowCount >= 2 && matchdayIndex >= Math.ceil(totalMatchdays * 0.7)));

  return Math.min(canDoubleCommit ? 2 : 1, captainSlotsRemaining, worthUsingCount);
}

function buildCaptainDecisions(
  context: LegacyLineupLoadedContext,
  entries: Array<LegacyLineupEntryInput & { isCaptain: boolean }>,
  input: {
    d1DisciplineId: string | null;
    d2DisciplineId: string | null;
  },
) {
  const captainUsage = getCaptainUsageBeforeCurrentDraft(context);
  const captainSlotsUsed = captainUsage.count;
  const seasonCaptainSlots = context.captainRule?.seasonCaptainSlots ?? 0;
  const captainSlotsRemaining = Math.max(0, seasonCaptainSlots - captainSlotsUsed);

  const candidates = [
    suggestCaptainForSide(context, entries, input.d1DisciplineId, "d1"),
    suggestCaptainForSide(context, entries, input.d2DisciplineId, "d2"),
  ].filter((candidate): candidate is CaptainSuggestionCandidate => Boolean(candidate));
  const opportunityBySideKey = new Map<string, ReturnType<typeof evaluateAiCaptainOpportunity>>(
    candidates.map((candidate) => [
      `${candidate.disciplineId}::${candidate.disciplineSide}`,
      evaluateAiCaptainOpportunity(context, captainSlotsRemaining, candidate),
    ] as const),
  );

  const selectedCandidateKeys = new Set<string>();
  let newlyConsumedCaptainSlots = 0;
  const newCaptainSlotBudget = getAiCaptainNewSlotBudget(
    context,
    captainSlotsRemaining,
    Array.from(opportunityBySideKey.values()),
  );
  for (const candidate of [...candidates].sort((left, right) => right.estimatedContribution - left.estimatedContribution)) {
    const sideKey = `${candidate.disciplineId}::${candidate.disciplineSide}`;
    const alreadyConsumedThisSeason = captainUsage.hasExactSideKeys && captainUsage.sideKeys.has(sideKey);
    const opportunity = opportunityBySideKey.get(sideKey);

    if (alreadyConsumedThisSeason || (opportunity?.isWorthUsing && newlyConsumedCaptainSlots < newCaptainSlotBudget)) {
      selectedCandidateKeys.add(sideKey);
      if (!alreadyConsumedThisSeason) {
        newlyConsumedCaptainSlots += 1;
      }
    }
  }

  const decisionsBySide = new Map<DisciplineSide, CaptainDecision>();
  for (const side of ["d1", "d2"] as const) {
    const candidate = candidates.find((entry) => entry.disciplineSide === side) ?? null;

    if (!candidate) {
      decisionsBySide.set(side, {
        candidate: null,
        status: "skipped_not_needed",
        warnings: [],
      });
      continue;
    }

    if ((context.captainRule?.sourceStatus ?? "missing_source") === "missing_source") {
      decisionsBySide.set(side, {
        candidate,
        status: "blocked_policy",
        warnings: ["captain_policy_source_missing"],
      });
      continue;
    }

    const sideKey = `${candidate.disciplineId}::${candidate.disciplineSide}`;
    const alreadyConsumedThisSeason = captainUsage.hasExactSideKeys && captainUsage.sideKeys.has(sideKey);

    if (captainSlotsRemaining <= 0 && !alreadyConsumedThisSeason) {
      decisionsBySide.set(side, {
        candidate,
        status: "skipped_limit_reached",
        warnings: ["captain_limit_reached"],
      });
      continue;
    }

    if (selectedCandidateKeys.has(sideKey)) {
      const opportunity = opportunityBySideKey.get(sideKey);
      decisionsBySide.set(side, {
        candidate,
        status: "selected",
        warnings: [
          ...candidate.warnings,
          ...(opportunity?.reasons.length
            ? [`Captain genutzt: ${opportunity.score}/${opportunity.threshold} · ${opportunity.reasons.map(formatCaptainReasonToken).join(", ")}`]
            : []),
        ],
      });
      continue;
    }

    const opportunity = opportunityBySideKey.get(sideKey);
    decisionsBySide.set(side, {
      candidate,
      status: captainSlotsRemaining <= 0 ? "skipped_limit_reached" : "skipped_not_needed",
      warnings:
        captainSlotsRemaining <= 0
          ? ["captain_limit_reached", ...candidate.warnings]
          : [
              ...candidate.warnings,
              ...(opportunity
                ? [`Captain gespart: ${opportunity.score}/${opportunity.threshold} · ${opportunity.reasons.map(formatCaptainReasonToken).join(", ") || "kein klares Fenster"}`]
                : []),
            ],
    });
  }

  const decisions = [decisionsBySide.get("d1")!, decisionsBySide.get("d2")!];
  const nextEntries = applyCaptainDecisions(entries, decisions);

  return {
    entries: nextEntries,
    captainSlotsUsed,
    captainSlotsRemaining: Math.max(0, captainSlotsRemaining - newlyConsumedCaptainSlots),
    captainUsedBeforeCurrentDraftSides: Array.from(captainUsage.sideKeys),
    d1: decisionsBySide.get("d1")!,
    d2: decisionsBySide.get("d2")!,
  };
}

function buildPreviewSide(
  context: LegacyLineupLoadedContext,
  entries: LegacyLineupEntryInput[],
  disciplineId: string | null,
  disciplineSide: DisciplineSide,
  baseReasoning: string[],
  captainDecision: CaptainDecision,
  captainSlotsUsed: number,
  captainSlotsRemaining: number,
  selectionReasons: AiSideSelectionReason[],
): AiLegacyLineupSuggestionSide {
  const requiredPlayers =
    (disciplineId
      ? context.disciplineSidePlayerCounts?.[`${disciplineId}::${disciplineSide}`] ??
        context.disciplinePlayerCounts[disciplineId] ??
        0
      : 0) ?? 0;

  if (!disciplineId) {
    return {
      disciplineId: null,
      disciplineSide,
      disciplineName: null,
      status: "blocked",
      requiredPlayers,
      selectedPlayers: 0,
      missingSlots: requiredPlayers,
      captainActivePlayerId: captainDecision.candidate?.activePlayerId ?? null,
      captainPlayerId: captainDecision.candidate?.playerId ?? null,
      captainName: captainDecision.status === "selected" ? captainDecision.candidate?.captainName ?? null : null,
      captainSlotsUsed,
      captainSlotsRemaining,
      captainSelectionStatus: captainDecision.status,
      expectedBaseScore: null,
      expectedCaptainBonus: null,
      expectedScore: 0,
      teamDisciplineRank: null,
      rankSourceStatus: null,
      selectedEntries: [],
      fatigueWarnings: [`Keine Disziplin fuer ${disciplineSide} konfiguriert.`],
      warnings: [`Keine Disziplin fuer ${disciplineSide} konfiguriert.`],
      reasoning: baseReasoning,
    };
  }

  const scorePreview = scoreLegacyLineupDisciplineSide({
    disciplineId,
    disciplineSide,
    entries,
    disciplineScores: context.disciplineScores,
    activePlayers: context.activePlayers,
    rosterPlayers: context.rosterPlayers,
    requiredPlayers,
    fatigueByPlayerId: context.fatigueByPlayerId ?? null,
    fatigueSourceStatus: context.fatigueSourceStatus ?? "missing_source",
    formCardsAvailable: null,
    formCardsSelected: null,
    formModifier: null,
    mutatorText: null,
    mutatorModifier: null,
  });

  const fatigueWarnings = [
    ...(scorePreview.modifierWarnings ?? []).filter((warning) => warning.toLowerCase().includes("fatigue")),
    ...scorePreview.entries
      .filter((entry) => (entry.fatigueCount ?? 0) > 0)
      .map((entry) => `${entry.name ?? entry.playerId}: Fatigue x${(entry.fatigueMultiplier ?? 1).toFixed(2)}`),
  ];
  const criticalWarnings = [
    ...scorePreview.validationWarnings.filter(
      (warning) =>
        warning.includes("Missing discipline score") || warning.includes("is incomplete"),
    ),
    ...scorePreview.missingScores.map((score) => `Missing score: ${score}`),
  ];
  const sideWarnings = [
    ...criticalWarnings,
    ...scorePreview.validationWarnings.filter(
      (warning) =>
        !warning.includes("Missing discipline score") && !warning.includes("is incomplete"),
    ),
  ];
  const reasonByEntryKey = new Map(
    selectionReasons.map((reason) => [
      `${reason.playerId}::${reason.activePlayerId}::${reason.slotIndex}`,
      reason,
    ]),
  );
  const selectedEntries: AiLegacyLineupSelectedPlayer[] = scorePreview.entries.map((entry) => {
    const reason = reasonByEntryKey.get(`${entry.playerId}::${entry.activePlayerId ?? ""}::${entry.slotIndex}`) ?? null;
    return {
      selectionScore: reason?.selectionScore ?? null,
      demandBonus: reason?.demandBonus ?? null,
      identityTieBreak: reason?.identityTieBreak ?? null,
      demandReasons: reason?.demandReasons ?? [],
      selectionReason: reason?.reason ?? null,
      playerId: entry.playerId,
      activePlayerId: entry.activePlayerId ?? null,
      name: entry.name ?? null,
      isCaptain: Boolean(entry.isCaptain),
      baseScore: entry.baseDisciplineScore ?? null,
      fatigueCount: entry.fatigueCount ?? null,
      fatigueMultiplier: entry.fatigueMultiplier ?? null,
      fatigueAdjustedScore: entry.fatigueAdjustedScore ?? null,
      captainBonus: entry.captainBonus ?? null,
      finalContribution: entry.finalContribution ?? null,
    };
  });
  const selectedPlayers = scorePreview.selectedPlayers ?? scorePreview.entries.length;
  const missingSlots = Math.max(0, requiredPlayers - selectedPlayers);
  const rankEntry = context.teamDisciplineRanks?.[disciplineId] ?? null;
  const status = getSideStatus({
    disciplineId,
    selectedPlayers,
    requiredPlayers,
    missingScores: scorePreview.missingScores,
    warnings: criticalWarnings,
  });

  return {
    disciplineId,
    disciplineSide,
    disciplineName: getDisciplineName(context, disciplineId),
    requiredPlayers,
    status,
    selectedPlayers,
    missingSlots,
    captainActivePlayerId: captainDecision.candidate?.activePlayerId ?? null,
    captainPlayerId: captainDecision.candidate?.playerId ?? null,
    captainName: captainDecision.status === "selected" ? captainDecision.candidate?.captainName ?? null : null,
    captainSlotsUsed,
    captainSlotsRemaining,
    captainSelectionStatus: captainDecision.status,
    expectedBaseScore: scorePreview.baseScore ?? null,
    expectedCaptainBonus: scorePreview.captainBonusTotal ?? null,
    expectedScore: scorePreview.totalScore,
    teamDisciplineRank: rankEntry?.rank ?? null,
    rankSourceStatus: rankEntry?.sourceStatus ?? null,
    selectedEntries,
    fatigueWarnings,
    warnings: sideWarnings,
    reasoning: [
      ...baseReasoning,
      ...(captainDecision.status === "selected" && captainDecision.candidate?.captainName
        ? [`Captain: ${captainDecision.candidate.captainName}`]
        : captainDecision.status === "skipped_limit_reached"
          ? ["Captain uebersprungen: Saisonlimit erreicht"]
          : captainDecision.status === "skipped_reserved"
            ? ["Captain gespart: Saisonbudget fuer spaetere Matchdays reserviert"]
          : ["Kein Captain-Vorschlag"]),
    ],
  };
}

export function buildAiLegacyLineupPreview(
  context: LegacyLineupLoadedContext,
  source: "sqlite" | "prisma" = "sqlite",
): AiLegacyLineupPreview {
  const suggestion = buildAiLegacyLineupSuggestion(context);
  const captainRuleStatus = context.captainRule?.sourceStatus ?? "missing_source";

  let entries: Array<LegacyLineupEntryInput & { isCaptain: boolean }> = suggestion.entries.map((entry) => ({
    ...entry,
    isCaptain: false,
  }));
  const d1BaseReasoning = suggestion.debugReasoning.filter((line) => line.startsWith("D1"));
  const d2BaseReasoning = suggestion.debugReasoning.filter((line) => line.startsWith("D2"));
  const d1DisciplineId = context.contextMeta.d1DisciplineId;
  const d2DisciplineId = context.contextMeta.d2DisciplineId;

  const captainPlan = buildCaptainDecisions(context, entries, {
    d1DisciplineId,
    d2DisciplineId,
  });
  entries = captainPlan.entries;

  const d1 = buildPreviewSide(
    context,
    entries,
    d1DisciplineId,
    "d1",
    d1BaseReasoning,
    captainPlan.d1,
    captainPlan.captainSlotsUsed,
    captainPlan.captainSlotsRemaining,
    suggestion.d1SelectionReasons,
  );
  const d2 = buildPreviewSide(
    context,
    entries,
    d2DisciplineId,
    "d2",
    d2BaseReasoning,
    captainPlan.d2,
    captainPlan.captainSlotsUsed,
    captainPlan.captainSlotsRemaining,
    suggestion.d2SelectionReasons,
  );

  const validation = validateLegacyLineupContext(
    {
      ...context,
      entries,
    },
    {
      enforceCompleteness: false,
      seasonCaptainLimit: context.captainRule?.seasonCaptainSlots,
      captainUsedBeforeCurrentDraft: captainPlan.captainSlotsUsed,
      captainUsedBeforeCurrentDraftSides: captainPlan.captainUsedBeforeCurrentDraftSides,
    },
  );

  const fullScorePreview = buildLegacyLineupAggregateScore(
    [
      d1DisciplineId
        ? scoreLegacyLineupDisciplineSide({
            disciplineId: d1DisciplineId,
            disciplineSide: "d1",
            entries,
            disciplineScores: context.disciplineScores,
            activePlayers: context.activePlayers,
            rosterPlayers: context.rosterPlayers,
            requiredPlayers: context.disciplineSidePlayerCounts?.[`${d1DisciplineId}::d1`] ?? context.disciplinePlayerCounts[d1DisciplineId] ?? null,
            fatigueByPlayerId: context.fatigueByPlayerId ?? null,
            fatigueSourceStatus: context.fatigueSourceStatus ?? "missing_source",
            formCardsAvailable: null,
            formCardsSelected: null,
            formModifier: null,
            mutatorText: null,
            mutatorModifier: null,
          })
        : null,
      d2DisciplineId
        ? scoreLegacyLineupDisciplineSide({
            disciplineId: d2DisciplineId,
            disciplineSide: "d2",
            entries,
            disciplineScores: context.disciplineScores,
            activePlayers: context.activePlayers,
            rosterPlayers: context.rosterPlayers,
            requiredPlayers: context.disciplineSidePlayerCounts?.[`${d2DisciplineId}::d2`] ?? context.disciplinePlayerCounts[d2DisciplineId] ?? null,
            fatigueByPlayerId: context.fatigueByPlayerId ?? null,
            fatigueSourceStatus: context.fatigueSourceStatus ?? "missing_source",
            formCardsAvailable: null,
            formCardsSelected: null,
            formModifier: null,
            mutatorText: null,
            mutatorModifier: null,
          })
        : null,
    ].filter((entry): entry is NonNullable<typeof entry> => Boolean(entry)),
  );

  const warnings = [
    ...suggestion.warnings,
    ...captainPlan.d1.warnings,
    ...captainPlan.d2.warnings,
    ...validation.errors,
    ...validation.warnings,
  ];
  const status = getPreviewStatus(d1, d2, warnings);
  const strategyExplanation = buildStrategyProfileExplanation(context);
  const explanation = [
    strategyExplanation,
    buildSideExplanation(d1.disciplineName, d1.selectedPlayers, d1.requiredPlayers, d1.captainName, d1.fatigueWarnings, d1.warnings),
    buildSideExplanation(d2.disciplineName, d2.selectedPlayers, d2.requiredPlayers, d2.captainName, d2.fatigueWarnings, d2.warnings),
  ]
    .filter((entry): entry is string => Boolean(entry))
    .join(" | ");

  return {
    source,
    readOnly: true,
    teamId: context.teamId,
    teamCode: context.team.shortCode,
    teamName: context.team.name,
    matchdayId: context.matchdayId,
    status,
    captainRuleStatus,
    captainSlotsUsed: captainPlan.captainSlotsUsed,
    captainSlotsRemaining: captainPlan.captainSlotsRemaining,
    totalExpectedScore: fullScorePreview.totalScore,
    expectedScore: fullScorePreview.totalScore,
    warnings,
    explanation,
    debugReasoning: [...(strategyExplanation ? [`Strategy: ${strategyExplanation}`] : []), ...suggestion.debugReasoning],
    d1,
    d2,
    entries,
    scorePreview: {
      ...fullScorePreview,
      validationWarnings: [...validation.warnings, ...fullScorePreview.validationWarnings],
    },
  };
}
