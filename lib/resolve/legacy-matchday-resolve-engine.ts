import { hasResolveReadyModifierSources } from "@/lib/lineups/legacy-modifier-source-contract";
import { calculateSideSlotRoleModifierTotal } from "@/lib/lineups/matchday-slot-roles";
import { scoreLegacyLineupDisciplineSide } from "@/lib/lineups/legacy-score-engine";
import type { LegacyLineupLoadedContext, LegacyResolvePreviewOptions } from "@/lib/lineups/legacy-lineup-types";
import {
  calculateMvpForcedMutatorModifierForSide,
  calculateFormModifierForSide,
  calculateMutatorModifierForSide,
  buildMatchdayMutatorTraitsBySide,
  getFormCardColorForDisciplineCategory,
} from "@/lib/lineups/legacy-lineup-modifiers";
import { calculatePassiveTeamPowerBonus, calculateTeamPowerModifierForSide } from "@/lib/lineups/team-powers";
import { getTeamRelationship } from "@/lib/rivalries/team-rivalries";
import { selectTeamCaptain } from "@/lib/morale/player-demands-service";
import { buildPlayerMoralePerformanceMap } from "@/lib/morale/player-morale-performance";
import { distributeRankPointsToPlayers, getRankToPointsValue } from "@/lib/resolve/rank-to-points";
import type {
  DisciplineHighlightCandidate,
  DisciplineResolvePreview,
  DisciplineTeamResolvePreview,
  LegacyMatchdayResolvePreview,
  PlayerPerformancePreview,
  ResolvePreviewStatus,
  TeamResolvePreview,
} from "@/lib/resolve/legacy-matchday-resolve-types";

function rankDescending<T>(items: T[], scoreAccessor: (item: T) => number) {
  return [...items]
    .sort((left, right) => scoreAccessor(right) - scoreAccessor(left))
    .map((item, index) => ({ item, rank: index + 1 }));
}

function roundScore(value: number) {
  return Math.round(value * 10) / 10;
}

function selectDebuffTargets(input: {
  source: DisciplineTeamResolvePreview;
  teamResults: DisciplineTeamResolvePreview[];
  preRanksByTeamId: Map<string, number>;
}) {
  const eligible = input.teamResults.filter((team) => team.teamId !== input.source.teamId && !team.missingLineup);
  if (eligible.length === 0 || !input.source.teamPowerEffectType || !input.source.teamPowerTargetMode) {
    return [];
  }

  const sourceRank = input.preRanksByTeamId.get(input.source.teamId) ?? input.source.rank;
  const sortedByScore = [...eligible].sort((left, right) => right.score - left.score);
  const sortedByRankDistance = [...eligible].sort((left, right) => {
    const leftDistance = Math.abs((input.preRanksByTeamId.get(left.teamId) ?? left.rank) - sourceRank);
    const rightDistance = Math.abs((input.preRanksByTeamId.get(right.teamId) ?? right.rank) - sourceRank);
    if (leftDistance !== rightDistance) return leftDistance - rightDistance;
    return right.score - left.score;
  });
  const rivalTarget = [...eligible].sort((left, right) => {
    const leftValue = getTeamRelationship(input.source.teamId, left.teamId)?.value ?? 0;
    const rightValue = getTeamRelationship(input.source.teamId, right.teamId)?.value ?? 0;
    if (leftValue !== rightValue) return leftValue - rightValue;
    return right.score - left.score;
  })[0] ?? null;

  if (input.source.teamPowerTargetMode === "single_rival") {
    return [rivalTarget ?? sortedByScore[0]].filter((team): team is DisciplineTeamResolvePreview => Boolean(team));
  }

  if (input.source.teamPowerTargetMode === "single_top") {
    return [sortedByScore[0]].filter((team): team is DisciplineTeamResolvePreview => Boolean(team));
  }

  if (input.source.teamPowerTargetMode === "single_rank_neighbor") {
    return [sortedByRankDistance[0]].filter((team): team is DisciplineTeamResolvePreview => Boolean(team));
  }

  if (input.source.teamPowerTargetMode === "rank_band") {
    const limit = Math.max(input.source.teamPowerTargetLimit ?? 2, 1);
    return sortedByRankDistance.slice(0, limit);
  }

  return [];
}

function applyTeamPowerDebuffs(teamResults: DisciplineTeamResolvePreview[]) {
  const preRanked = rankDescending(teamResults, (team) => team.score);
  const preRanksByTeamId = new Map(preRanked.map(({ item, rank }) => [item.teamId, rank] as const));
  const debuffSources = teamResults.filter(
    (team) =>
      (team.teamPowerEffectType === "snipe_debuff" ||
        team.teamPowerEffectType === "field_debuff" ||
        team.teamPowerEffectType === "rivalry_debuff") &&
      (team.teamPowerImpact ?? 0) > 0,
  );

  if (debuffSources.length === 0) {
    return teamResults;
  }

  const debuffByTeamId = new Map<string, { amount: number; labels: string[] }>();
  for (const source of debuffSources) {
    const targets = selectDebuffTargets({ source, teamResults, preRanksByTeamId });
    const impactPct = source.teamPowerImpact ?? 0;
    for (const target of targets) {
      const rawImpact = roundScore((target.score * impactPct) / 100);
      const perTargetImpact = source.teamPowerEffectType === "field_debuff" ? roundScore(rawImpact * 0.65) : rawImpact;
      const current = debuffByTeamId.get(target.teamId) ?? { amount: 0, labels: [] };
      current.amount = roundScore(current.amount + perTargetImpact);
      current.labels.push(`${source.teamName}: ${source.teamPowerLabel ?? "Team-Power"} -${perTargetImpact} (${impactPct}%)`);
      debuffByTeamId.set(target.teamId, current);
    }
  }

  return teamResults.map((team) => {
    const debuff = debuffByTeamId.get(team.teamId);
    if (!debuff) {
      return team;
    }
    const nextScore = roundScore(Math.max(team.score - debuff.amount, 0));
    return {
      ...team,
      finalPreviewScore: nextScore,
      score: nextScore,
      warnings: [...team.warnings, ...debuff.labels.map((label) => `team_power_debuff:${label}`)],
    };
  });
}

function buildPlayerNameResolver(contexts: LegacyLineupLoadedContext[]) {
  const byPlayerId = new Map<string, string>();
  for (const context of contexts) {
    for (const player of context.rosterPlayers) {
      byPlayerId.set(player.id, player.name);
    }
  }
  return (playerId: string) => byPlayerId.get(playerId) ?? playerId;
}

function buildDisciplineNameResolver(contexts: LegacyLineupLoadedContext[]) {
  const byDisciplineId = new Map<string, string>();
  for (const context of contexts) {
    for (const discipline of context.disciplines) {
      byDisciplineId.set(discipline.id, discipline.name);
    }
  }
  return (disciplineId: string) => byDisciplineId.get(disciplineId) ?? disciplineId;
}

function getDisciplineSideMeta(context: LegacyLineupLoadedContext) {
  return [
    { disciplineSide: "d1" as const, disciplineId: context.contextMeta.d1DisciplineId },
    { disciplineSide: "d2" as const, disciplineId: context.contextMeta.d2DisciplineId },
  ].filter((entry): entry is { disciplineSide: "d1" | "d2"; disciplineId: string } => Boolean(entry.disciplineId));
}

function resolveSideStatus(input: {
  disciplineId: string | null;
  missingLineup: boolean;
  missingScores: string[];
  isComplete: boolean;
  missingSources: boolean;
}): ResolvePreviewStatus {
  if (!input.disciplineId) return "blocked";
  if (input.missingLineup) return "missing_lineups";
  if (input.missingScores.length > 0) return "missing_scores";
  if (!input.isComplete) return "incomplete_lineups";
  if (input.missingSources) return "missing_sources";
  return "ready";
}

function getWorseStatus(left: ResolvePreviewStatus, right: ResolvePreviewStatus): ResolvePreviewStatus {
  const priority: Record<ResolvePreviewStatus, number> = {
    ready: 0,
    missing_sources: 1,
    incomplete_lineups: 2,
    missing_lineups: 3,
    missing_scores: 4,
    blocked: 5,
  };
  return priority[left] >= priority[right] ? left : right;
}

function shouldFlagMissingSources(
  score: ReturnType<typeof scoreLegacyLineupDisciplineSide>,
  resolveOptions: LegacyResolvePreviewOptions,
  context: LegacyLineupLoadedContext,
) {
  if (resolveOptions.modifierMode === "mvp_forced_mutators") {
    return false;
  }
  if (!hasResolveReadyModifierSources(context)) {
    return true;
  }
  return score.fatigueStatus !== "mapped";
}

const LEGACY_MATCHDAY_MINIMUM_PLAYERS = 7;

function isPartialLineupAllowed(context: LegacyLineupLoadedContext) {
  const requiredTotalUniquePlayers = getDisciplineSideMeta(context).reduce((sum, meta) => {
    return (
      sum +
      (
        context.disciplineSidePlayerCounts?.[`${meta.disciplineId}::${meta.disciplineSide}`] ??
        context.disciplinePlayerCounts[meta.disciplineId] ??
        0
      )
    );
  }, 0);
  const selectedPlayerIds = new Set((context.existingDraft?.entries ?? []).map((entry) => entry.playerId));

  return (
    context.activePlayers.length >= LEGACY_MATCHDAY_MINIMUM_PLAYERS &&
    context.activePlayers.length < requiredTotalUniquePlayers &&
    selectedPlayerIds.size === context.activePlayers.length
  );
}

export function buildLegacyMatchdayResolvePreview(
  contexts: LegacyLineupLoadedContext[],
  options?: LegacyResolvePreviewOptions,
): LegacyMatchdayResolvePreview {
  if (contexts.length === 0) {
    throw new Error("At least one loaded legacy lineup context is required for matchday resolve preview.");
  }

  const resolveOptions: LegacyResolvePreviewOptions = {
    modifierMode: options?.modifierMode ?? "legacy_selected_traits",
    captainMode: options?.captainMode ?? "selected_captain",
  };
  const base = contexts[0];
  const matchdayMutatorTraitsBySide = buildMatchdayMutatorTraitsBySide({
    saveId: base.saveId,
    seasonId: base.seasonId,
    matchdayId: base.matchdayId,
    d1DisciplineId: base.contextMeta.d1DisciplineId,
    d2DisciplineId: base.contextMeta.d2DisciplineId,
  });
  const resolveWarnings: string[] = [];
  const missingLineups: Array<{ teamId: string; teamName: string }> = [];
  const incompleteLineups: Array<{ teamId: string; teamName: string; disciplineSide: "d1" | "d2" }> = [];
  const missingScores = new Set<string>();
  const getPlayerName = buildPlayerNameResolver(contexts);
  const getDisciplineName = buildDisciplineNameResolver(contexts);

  const disciplineBuckets = new Map<string, Array<{
    context: LegacyLineupLoadedContext;
    side: "d1" | "d2";
    score: ReturnType<typeof scoreLegacyLineupDisciplineSide>;
  }>>();

  const teamResultsUnranked: TeamResolvePreview[] = contexts.map((context) => {
    const draft = context.existingDraft;
    const warnings = [...(draft ? [] : ["No existing legacy lineup draft was found for this team and matchday."])];
    const missingLineup = !draft;
    const allowPartialLineup = !missingLineup && isPartialLineupAllowed(context);
    if (allowPartialLineup) {
      warnings.push(`partial_lineup_allowed:${context.activePlayers.length}_active_players`);
    }
    if (missingLineup) {
      missingLineups.push({ teamId: context.team.id, teamName: context.team.name });
    }

    let d1Score = 0;
    let d2Score = 0;
    let d1DisciplineId = context.contextMeta.d1DisciplineId;
    let d2DisciplineId = context.contextMeta.d2DisciplineId;
    let d1Status: ResolvePreviewStatus = d1DisciplineId ? "ready" : "blocked";
    let d2Status: ResolvePreviewStatus = d2DisciplineId ? "ready" : "blocked";
    const resolvePlayerIds = new Set((draft?.entries ?? []).map((entry) => entry.playerId));
    const moraleByPlayerId = buildPlayerMoralePerformanceMap({
      gameState: context.gameState,
      teamId: context.teamId,
      rosterEntries:
        context.gameState?.rosters.filter((entry) => entry.teamId === context.teamId && resolvePlayerIds.has(entry.playerId)) ??
        null,
    });

    for (const meta of getDisciplineSideMeta(context)) {
      const sideEntries = (draft?.entries ?? []).filter(
        (entry) => entry.disciplineId === meta.disciplineId && entry.disciplineSide === meta.disciplineSide,
      );
      const slotRoleModifier = calculateSideSlotRoleModifierTotal({
        disciplineId: meta.disciplineId,
        disciplineSide: meta.disciplineSide,
        entries: sideEntries.map((entry) => ({ playerId: entry.playerId, slotIndex: entry.slotIndex })),
        rosterPlayers: context.rosterPlayers,
        disciplineScores: context.disciplineScores,
        intensity: draft?.modifiers?.[meta.disciplineSide]?.intensity ?? "normal",
        fatigueByPlayerId: context.fatigueByPlayerId ?? null,
        requiredPlayers:
          context.disciplineSidePlayerCounts?.[`${meta.disciplineId}::${meta.disciplineSide}`] ??
          context.disciplinePlayerCounts[meta.disciplineId] ??
          null,
      });
      const score = scoreLegacyLineupDisciplineSide({
        disciplineId: meta.disciplineId,
        disciplineSide: meta.disciplineSide,
        entries: draft?.entries ?? [],
        disciplineScores: context.disciplineScores,
        activePlayers: context.activePlayers,
        rosterPlayers: context.rosterPlayers,
        requiredPlayers:
          context.disciplineSidePlayerCounts?.[`${meta.disciplineId}::${meta.disciplineSide}`] ??
          context.disciplinePlayerCounts[meta.disciplineId] ??
          null,
            fatigueByPlayerId: context.fatigueByPlayerId ?? null,
            injuryByPlayerId: context.injuryByPlayerId ?? null,
            moraleByPlayerId,
            fatigueSourceStatus: context.fatigueSourceStatus ?? "missing_source",
            injurySourceStatus: context.injurySourceStatus ?? "not_applied",
            intensity: draft?.modifiers?.[meta.disciplineSide]?.intensity,
            slotRoleModifier,
            ...(() => {
          const formResult = calculateFormModifierForSide({
            modifiers: draft?.modifiers,
            disciplineSide: meta.disciplineSide,
            disciplineColor: getFormCardColorForDisciplineCategory(
              context.disciplines.find((discipline) => discipline.id === meta.disciplineId)?.category,
            ),
            playerCount: sideEntries.length,
            formCards: context.formCards ?? [],
          });
          const mutatorResult =
            resolveOptions.modifierMode === "mvp_forced_mutators"
              ? calculateMvpForcedMutatorModifierForSide({
                disciplineId: meta.disciplineId,
                disciplineSide: meta.disciplineSide,
                entries: sideEntries.map((entry) => ({ playerId: entry.playerId })),
                disciplineScores: context.disciplineScores,
                rosterPlayers: context.rosterPlayers,
              })
              : calculateMutatorModifierForSide({
                  modifiers: draft?.modifiers,
                  disciplineSide: meta.disciplineSide,
                  entries: sideEntries.map((entry) => ({ playerId: entry.playerId })),
                  rosterPlayers: context.rosterPlayers,
                  matchdayMutatorTraits: matchdayMutatorTraitsBySide[meta.disciplineSide],
                });
          const effectiveMutatorModifier =
            context.mutatorSource?.effectStatus === "ready" ? mutatorResult.mutatorModifier : null;
          const effectiveMutatorBonuses = context.mutatorSource?.effectStatus === "ready" ? mutatorResult.playerMutatorBonuses : null;
          const effectiveMutatorPpsBonuses =
            context.mutatorSource?.effectStatus === "ready" ? mutatorResult.playerMutatorPpsBonuses : null;
          const disciplineCategory = context.disciplines.find((discipline) => discipline.id === meta.disciplineId)?.category;
          const selectedTeamPower = context.teamPowers?.find(
            (power) => power.id === draft?.modifiers?.[meta.disciplineSide]?.teamPowerId,
          ) ?? null;
          const conditionalBonusPct =
            selectedTeamPower?.conditionalTrigger === "rival_top8_discipline" &&
            (context.teamPowerWindows?.[meta.disciplineId]?.top8Rivals.length ?? 0) > 0
              ? selectedTeamPower.conditionalBonusPct
              : 0;
          const teamCaptain = context.gameState ? selectTeamCaptain(context.gameState, context.teamId) : null;
          const teamPowerResult = calculateTeamPowerModifierForSide({
            modifiers: draft?.modifiers,
            disciplineSide: meta.disciplineSide,
            disciplineId: meta.disciplineId,
            disciplineCategory,
            teamPowers: context.teamPowers ?? [],
            teamCaptainPowerModifierPct: teamCaptain?.effects.teamPowerModifierPct ?? null,
            conditionalBonusPct,
          });
          // Always-on passive team bonus: applies to every discipline side every matchday, needs
          // no charge, and stacks additively on top of any manually selected team power.
          const passiveTeamPowerBonus = calculatePassiveTeamPowerBonus(context.teamPowers ?? [], disciplineCategory);
          const effectiveTeamPowerModifier =
            context.teamPowerSource?.effectStatus === "ready" ? teamPowerResult.teamPowerModifier : null;
          const teamPowerLabelWithPassive =
            passiveTeamPowerBonus > 0
              ? `${teamPowerResult.teamPowerLabel ? `${teamPowerResult.teamPowerLabel} ` : ""}(+${passiveTeamPowerBonus}% Identität)`
              : teamPowerResult.teamPowerLabel;

          return {
            formCardsAvailable: formResult.formCardsAvailable,
            formCardsSelected: formResult.formCardsSelected,
            formCardStatus: context.formCardSource?.effectStatus === "ready" ? "ready" : "missing_source",
            formCardLabel: formResult.formCardLabel,
            formModifier: formResult.formModifier,
            mutatorMode: mutatorResult.mutatorMode,
            mutatorText: mutatorResult.mutatorText,
            mutatorModifier: effectiveMutatorModifier,
            mutatorSlots: context.mutatorSource?.effectStatus === "ready" ? mutatorResult.mutatorSlots : [],
            mutatorBonusByPlayerId: effectiveMutatorBonuses,
            mutatorPpsBonusByPlayerId: effectiveMutatorPpsBonuses,
            teamPowerSelected: teamPowerResult.teamPowerSelected,
            teamPowerStatus: context.teamPowerSource?.effectStatus === "ready" ? "ready" : "missing_source",
            teamPowerLabel: teamPowerLabelWithPassive,
            teamPowerModifier: effectiveTeamPowerModifier,
            passiveTeamPowerImpactPct: passiveTeamPowerBonus,
            teamPowerImpact: teamPowerResult.teamPowerImpact,
            teamPowerBasePct: teamPowerResult.teamPowerBasePct,
            teamPowerConditionalPct: teamPowerResult.teamPowerConditionalPct,
            teamPowerAttributeFitPct: teamPowerResult.teamPowerAttributeFitPct,
            teamPowerEffectType: selectedTeamPower?.effectType ?? null,
            teamPowerTargetMode: selectedTeamPower?.targetMode ?? null,
            teamPowerTargetLimit: selectedTeamPower?.targetLimit ?? null,
            captainMode: resolveOptions.captainMode,
            captainStatus: resolveOptions.captainMode === "missing_source" ? "missing_source" : "mapped",
            teamPpsModifier: context.mutatorSource?.effectStatus === "ready" ? mutatorResult.teamPpsModifier : null,
            teamPpsStatus: context.mutatorSource?.effectStatus === "ready" ? mutatorResult.teamPpsStatus : "missing_source",
          };
        })(),
      });

      for (const warning of score.validationWarnings) {
        warnings.push(warning);
      }
      for (const missing of score.missingScores) {
        missingScores.add(missing);
      }

      const bucket = disciplineBuckets.get(meta.disciplineId) ?? [];
      bucket.push({
        context,
        side: meta.disciplineSide,
        score,
      });
      disciplineBuckets.set(meta.disciplineId, bucket);

      if (meta.disciplineSide === "d1") {
        d1Score = score.totalScore;
        d1DisciplineId = meta.disciplineId;
        d1Status = resolveSideStatus({
          disciplineId: meta.disciplineId,
          missingLineup,
          missingScores: score.missingScores,
          isComplete: score.isComplete !== false || allowPartialLineup,
          missingSources: shouldFlagMissingSources(score, resolveOptions, context),
        });
      } else {
        d2Score = score.totalScore;
        d2DisciplineId = meta.disciplineId;
        d2Status = resolveSideStatus({
          disciplineId: meta.disciplineId,
          missingLineup,
          missingScores: score.missingScores,
          isComplete: score.isComplete !== false || allowPartialLineup,
          missingSources: shouldFlagMissingSources(score, resolveOptions, context),
        });
      }

      if (!missingLineup && score.isComplete === false && !allowPartialLineup) {
        incompleteLineups.push({
          teamId: context.team.id,
          teamName: context.team.name,
          disciplineSide: meta.disciplineSide,
        });
      }
    }

    const status = getWorseStatus(d1Status, d2Status);

    return {
      teamId: context.team.id,
      teamName: context.team.name,
      status,
      d1DisciplineId,
      d1Status,
      d1Score,
      d1Points: null,
      d2DisciplineId,
      d2Status,
      d2Score,
      d2Points: null,
      totalScore: d1Score + d2Score,
      totalPoints: null,
      rank: 0,
      warnings,
      missingLineup,
      missingScores: warnings.filter((warning) => warning.startsWith("Missing discipline score")),
    };
  });

  const rankedTeamsBeforePowers = rankDescending(teamResultsUnranked, (team) => team.totalScore).map(({ item, rank }) => ({
    ...item,
    rank,
  }));

  const disciplinePreviews: DisciplineResolvePreview[] = Array.from(disciplineBuckets.entries()).map(([disciplineId, bucket]) => {
    const rawTeamResults = bucket.map(({ context, side, score }) => ({
        teamId: context.team.id,
        teamName: context.team.name,
        disciplineId,
        disciplineSide: side,
        status: resolveSideStatus({
          disciplineId,
          missingLineup: !context.existingDraft,
          missingScores: score.missingScores,
          isComplete: score.isComplete !== false,
          missingSources: shouldFlagMissingSources(score, resolveOptions, context),
        }),
        baseScore: score.baseScore ?? 0,
        fatigueModifier: score.fatigueModifier ?? null,
        fatigueStatus: score.fatigueStatus ?? "missing_source",
        intensity: score.intensity ?? null,
        intensityModifier: score.intensityModifier ?? null,
        captainStatus: score.captainStatus ?? "missing_source",
        captainBonus: score.captainBonusTotal ?? null,
        formCardStatus: score.formCardStatus ?? "missing_source",
        formCardLabel: score.formCardLabel ?? null,
        formModifier: score.formModifier ?? null,
        mutatorMode: score.mutatorMode ?? "legacy_selected_traits",
        mutatorModifier: score.mutatorModifier ?? null,
        mutatorSlots: score.mutatorSlots ?? [],
        teamPowerStatus: score.teamPowerStatus ?? "missing_source",
        teamPowerLabel: score.teamPowerLabel ?? null,
        teamPowerModifier: score.teamPowerModifier ?? null,
        teamPowerImpact: score.teamPowerImpact ?? null,
        teamPowerBasePct: score.teamPowerBasePct ?? null,
        teamPowerConditionalPct: score.teamPowerConditionalPct ?? null,
        teamPowerAttributeFitPct: score.teamPowerAttributeFitPct ?? null,
        teamPowerEffectType: score.teamPowerEffectType ?? null,
        teamPowerTargetMode: score.teamPowerTargetMode ?? null,
        teamPowerTargetLimit: score.teamPowerTargetLimit ?? null,
        teamPpsModifier: score.teamPpsModifier ?? null,
        teamPpsStatus: score.teamPpsStatus ?? "missing_source",
        finalPreviewScore: score.finalPreviewScore ?? score.totalScore,
        score: score.finalPreviewScore ?? score.totalScore,
        rank: 0,
        teamPoints: null,
        pointSource: "rank_to_points_missing",
        warnings: [...score.validationWarnings, ...(context.existingDraft ? [] : ["Missing lineup for this discipline side."])],
        missingLineup: !context.existingDraft,
        missingPlayers: score.missingPlayers ?? 0,
        isComplete: score.isComplete !== false,
        missingScores: [...score.missingScores],
        entries: score.entries.map((entry) => ({
          playerId: entry.playerId,
          activePlayerId: entry.activePlayerId ?? null,
          playerName: entry.name ?? getPlayerName(entry.playerId),
          slotIndex: entry.slotIndex,
          baseValue: entry.baseDisciplineScore ?? entry.score,
          fatigueAdjustedValue: entry.fatigueAdjustedScore ?? null,
          captainBonus: entry.captainBonus ?? null,
          mutatorBonus: entry.mutatorBonus ?? null,
          mutatorPpsBonus: entry.mutatorPpsBonus ?? null,
          finalPlayerScore: entry.finalContribution ?? entry.score,
          pointsAwarded: null,
          isCaptain: Boolean(entry.isCaptain),
          warnings: entry.warnings ?? [],
        })),
      }));
    const teamResultsAfterPowers = applyTeamPowerDebuffs(rawTeamResults);
    const teamResultsRanked = rankDescending(
      teamResultsAfterPowers,
      (result) => result.score,
    ).map<DisciplineTeamResolvePreview>(({ item, rank }) => ({
      ...item,
      rank,
      teamPoints: getRankToPointsValue(
        bucket.find((entry) => entry.context.team.id === item.teamId && entry.side === item.disciplineSide)?.score.requiredPlayers ??
          item.entries.length,
        rank,
      ),
      pointSource: "rank_to_points_base_share",
    }));

    const rawPlayerEntries = bucket.flatMap(({ context, score, side }) => {
      const total = score.finalPreviewScore ?? score.totalScore;
      const rankedWithinTeam = rankDescending(score.entries, (entry) => entry.finalContribution ?? entry.score ?? 0).map(({ item, rank }) => ({
        entry: item,
        rankInTeam: rank,
      }));
      const rankedTeam = teamResultsRanked.find((entry) => entry.teamId === context.team.id && entry.disciplineSide === side);
      const distributedPoints = distributeRankPointsToPlayers({
        playerCount: score.requiredPlayers ?? rankedWithinTeam.length,
        rank: rankedTeam?.rank ?? null,
        entries: rankedWithinTeam.map(({ entry }) => ({
          baseValue: entry.baseDisciplineScore ?? entry.score ?? 0,
          finalPlayerScore: entry.finalContribution ?? entry.score ?? 0,
          scoreContribution: total > 0 ? (entry.finalContribution ?? entry.score ?? 0) / total : 0,
        })),
      });

      if (rankedTeam) {
        rankedTeam.pointSource = distributedPoints.pointSource;
        rankedTeam.teamPoints = distributedPoints.teamPoints;
        rankedTeam.warnings = Array.from(new Set([...rankedTeam.warnings, ...distributedPoints.warnings]));
        rankedTeam.entries = rankedTeam.entries.map((entry, index) => ({
          ...entry,
          pointsAwarded: distributedPoints.entries[index]?.points ?? entry.pointsAwarded ?? null,
        }));
      }

      return rankedWithinTeam.map(({ entry, rankInTeam }, index) => ({
        matchdayId: context.matchday.id,
        disciplineId,
        teamId: context.team.id,
        playerId: entry.playerId,
        activePlayerId: entry.activePlayerId,
        playerName: getPlayerName(entry.playerId),
        slotIndex: entry.slotIndex,
        baseValue: entry.baseDisciplineScore ?? entry.score ?? 0,
        fatigueAdjustedValue: entry.fatigueAdjustedScore ?? null,
        captainBonus: entry.captainBonus ?? null,
        mutatorBonus: entry.mutatorBonus ?? null,
        mutatorPpsBonus: entry.mutatorPpsBonus ?? null,
        finalPlayerScore: entry.finalContribution ?? entry.score ?? 0,
        scoreContribution: total > 0 ? (entry.finalContribution ?? entry.score ?? 0) / total : 0,
        pointsAwarded: distributedPoints.entries[index]?.points ?? null,
        pointSource: distributedPoints.pointSource,
        rankInTeam,
        rankInDiscipline: 0,
        isTop10: false,
        isMvpCandidate: false,
        storyWeight: total > 0 ? (entry.finalContribution ?? entry.score ?? 0) / total : 0,
        disciplineSide: score.disciplineSide ?? side,
      }));
    });

    const topPlayers = rankDescending(rawPlayerEntries, (entry) => entry.finalPlayerScore).map<PlayerPerformancePreview>(({ item, rank }) => ({
      ...item,
      rankInDiscipline: rank,
      isTop10: rank <= 10,
      isMvpCandidate: rank === 1,
    }));

    const highlightCandidates: DisciplineHighlightCandidate[] = [];
    const bestPlayer = topPlayers[0];
    if (bestPlayer) {
      highlightCandidates.push({
        matchdayId: bestPlayer.matchdayId,
        disciplineId,
        highlightType: "best_player_discipline",
        teamId: bestPlayer.teamId,
        playerId: bestPlayer.playerId,
        importanceScore: bestPlayer.finalPlayerScore,
        shortSummary: `Top player in ${getDisciplineName(disciplineId)}`,
        payload: {
          playerName: bestPlayer.playerName,
          finalPlayerScore: bestPlayer.finalPlayerScore,
          rankInDiscipline: bestPlayer.rankInDiscipline,
        },
      });
    }

    const strongestTeam = teamResultsRanked[0];
    if (strongestTeam) {
      highlightCandidates.push({
        matchdayId: base.matchday.id,
        disciplineId,
        highlightType: "strongest_team_score",
        teamId: strongestTeam.teamId,
        importanceScore: strongestTeam.score,
        shortSummary: `Strongest team score in ${getDisciplineName(disciplineId)}`,
        payload: {
          teamName: strongestTeam.teamName,
          score: strongestTeam.score,
          rank: strongestTeam.rank,
        },
      });
    }

    if (teamResultsRanked.length >= 2) {
      let closestPair: { left: DisciplineTeamResolvePreview; right: DisciplineTeamResolvePreview; gap: number } | null = null;
      const sortedByScore = [...teamResultsRanked].sort((left, right) => right.score - left.score);
      for (let index = 0; index < sortedByScore.length - 1; index += 1) {
        const left = sortedByScore[index];
        const right = sortedByScore[index + 1];
        const gap = Math.abs(left.score - right.score);
        if (!closestPair || gap < closestPair.gap) {
          closestPair = { left, right, gap };
        }
      }
      if (closestPair) {
        highlightCandidates.push({
          matchdayId: base.matchday.id,
          disciplineId,
          highlightType: "closest_score_gap",
          teamId: closestPair.left.teamId,
          relatedTeamId: closestPair.right.teamId,
          importanceScore: closestPair.gap === 0 ? 1 : 1 / closestPair.gap,
          shortSummary: `Closest score gap in ${getDisciplineName(disciplineId)}`,
          payload: {
            teamA: closestPair.left.teamName,
            teamB: closestPair.right.teamName,
            scoreA: closestPair.left.score,
            scoreB: closestPair.right.score,
            gap: closestPair.gap,
          },
        });
      }
    }

    for (const teamResult of teamResultsRanked.filter((result) => result.missingLineup)) {
      highlightCandidates.push({
        matchdayId: base.matchday.id,
        disciplineId,
        highlightType: "missing_lineup_warning",
        teamId: teamResult.teamId,
        importanceScore: 1,
        shortSummary: `Missing lineup for ${teamResult.teamName}`,
        payload: {
          teamName: teamResult.teamName,
          disciplineSide: teamResult.disciplineSide,
        },
      });
    }

    return {
      disciplineId,
      disciplineName: getDisciplineName(disciplineId),
      disciplineSide: teamResultsRanked[0]?.disciplineSide ?? "d1",
      teamResults: teamResultsRanked,
      topPlayers,
      highlightCandidates,
    };
  });

  const disciplineScoreSummaryByTeamId = new Map<string, { d1Score: number | null; d2Score: number | null }>();
  for (const disciplinePreview of disciplinePreviews) {
    for (const teamResult of disciplinePreview.teamResults) {
      const current = disciplineScoreSummaryByTeamId.get(teamResult.teamId) ?? { d1Score: null, d2Score: null };
      if (disciplinePreview.disciplineSide === "d1") {
        current.d1Score = teamResult.score;
      } else {
        current.d2Score = teamResult.score;
      }
      disciplineScoreSummaryByTeamId.set(teamResult.teamId, current);
    }
  }

  const rankedTeams = rankDescending(
    rankedTeamsBeforePowers.map((team) => {
      const scores = disciplineScoreSummaryByTeamId.get(team.teamId);
      const d1Score = scores?.d1Score ?? team.d1Score;
      const d2Score = scores?.d2Score ?? team.d2Score;
      return {
        ...team,
        d1Score,
        d2Score,
        totalScore: roundScore(d1Score + d2Score),
      };
    }),
    (team) => team.totalScore,
  ).map(({ item, rank }) => ({
    ...item,
    rank,
  }));

  for (const team of rankedTeams) {
    resolveWarnings.push(...team.warnings);
  }

  const disciplinePointSummaryByTeamId = new Map<string, { d1Points: number | null; d2Points: number | null }>();
  for (const disciplinePreview of disciplinePreviews) {
    for (const teamResult of disciplinePreview.teamResults) {
      const current = disciplinePointSummaryByTeamId.get(teamResult.teamId) ?? { d1Points: null, d2Points: null };
      if (disciplinePreview.disciplineSide === "d1") {
        current.d1Points = teamResult.teamPoints;
      } else {
        current.d2Points = teamResult.teamPoints;
      }
      disciplinePointSummaryByTeamId.set(teamResult.teamId, current);
    }
  }

  const rankedTeamsWithPoints = rankedTeams.map((team) => {
    const points = disciplinePointSummaryByTeamId.get(team.teamId) ?? { d1Points: null, d2Points: null };
    return {
      ...team,
      d1Points: points.d1Points,
      d2Points: points.d2Points,
      totalPoints:
        points.d1Points == null && points.d2Points == null
          ? null
          : Number(((points.d1Points ?? 0) + (points.d2Points ?? 0)).toFixed(1)),
    };
  });

  const status = rankedTeams.reduce<ResolvePreviewStatus>(
    (current, team) => getWorseStatus(current, team.status),
    "ready",
  );

  return {
    saveId: base.save.id,
    seasonId: base.season.id,
    matchdayId: base.matchday.id,
    status,
    disciplinePreviews: disciplinePreviews.sort((left, right) => left.disciplineSide.localeCompare(right.disciplineSide)),
    teamResults: rankedTeamsWithPoints,
    warnings: Array.from(new Set(resolveWarnings)),
    missingLineups,
    incompleteLineups,
    missingScores: Array.from(missingScores),
  };
}
