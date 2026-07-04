import type { GameState } from "@/lib/data/olyDataTypes";
import { getFacilityLevel, getTeamFacilityState } from "@/lib/facilities/facility-effects";
import {
  computeCompositeTopSixAverage,
  computeDisciplineTopSixImpact,
  computeTopSixAxisImpact,
  type TransfermarktDisciplineTopSixImpactRow,
  type TransfermarktTopSixAxisImpactRow,
} from "@/lib/market/transfermarkt-roster-impact";
import {
  buildScoutedDisciplineTiers,
  getScoutedTraitView,
  isScoutedImpactExact,
} from "@/lib/market/transfermarkt-scouting";
import {
  getEffectiveScoutingLevel,
  getFullRevealCertaintyThreshold,
  getPlayerScoutCertainty,
  getScoutFocusSummary,
} from "@/lib/scouting/facility-scout-pipeline-service";
import { getScoutingIntelMilestone } from "@/lib/scouting/scouting-hub-targets-service";
import { buildPlayerAxisStarProfile, revealAxisStarProfile } from "@/lib/scouting/player-axis-star-rating";
import { buildScoutingWatchTargetStarFields } from "@/lib/scouting/player-star-scouting-bridge";

export type ScoutingReportDisciplineTier = {
  disciplineId: string;
  disciplineName: string;
  displayedScore: number;
  scoreTier: string;
};

export type ScoutingReportData = {
  playerId: string;
  playerName: string;
  className: string;
  race: string;
  ageLabel: string | null;
  disciplineSpecialties: string[];
  marketValue: number | null;
  salary: number | null;
  certainty: number;
  effectiveScoutingLevel: number;
  neededCertainty: number;
  etaMatchdays: number | null;
  milestone: string;
  isFocusTarget: boolean;
  isFullyScouted: boolean;
  impactIsExact: boolean;
  axisOrbitStats: { pow: number; spe: number; men: number; soc: number } | null;
  axisStars: { pow: number | null; spe: number | null; men: number | null; soc: number | null };
  axisDisplayLabel: string;
  showAxisOrbit: boolean;
  showAxisStars: boolean;
  axisImpact: TransfermarktTopSixAxisImpactRow[];
  axisImpactComposite: { before: number | null; after: number | null; delta: number | null };
  disciplineImpact: TransfermarktDisciplineTopSixImpactRow[];
  disciplineTiers: ScoutingReportDisciplineTier[];
  caDisplay: string | null;
  poDisplay: string | null;
  poPotentialRating: number | null;
  potentialBand: string | null | undefined;
  traits: {
    visiblePositive: string[];
    visibleNegative: string[];
    hiddenPositiveCount: number;
    hiddenNegativeCount: number;
  };
};

/**
 * Builds the full "Scouting Report" for a wishlist target: how much they'd
 * move the viewer's own top-6 axis/discipline averages, their current
 * POW/SPE/MEN/SOC, CA/PO stars, and revealed traits — gated by the same
 * fog-of-war rules used across Transfermarkt.
 */
export function buildScoutingReport(input: {
  gameState: GameState;
  teamId: string;
  playerId: string;
  saveId: string;
  topCount?: number;
}): ScoutingReportData | null {
  const player = input.gameState.players.find((entry) => entry.id === input.playerId) ?? null;
  if (!player) {
    return null;
  }

  const facilityLevel = getFacilityLevel(getTeamFacilityState(input.gameState, input.teamId), "scouting_office");
  const certainty = getPlayerScoutCertainty(input.gameState, input.teamId, input.playerId);
  const effectiveScoutingLevel = getEffectiveScoutingLevel(input.gameState, input.teamId, input.playerId);
  const neededCertainty = getFullRevealCertaintyThreshold(facilityLevel);
  const isFullyScouted = effectiveScoutingLevel >= 5;
  const focusSummary = getScoutFocusSummary(input.gameState, input.teamId);
  const isFocusTarget = focusSummary?.playerId === input.playerId;
  const etaMatchdays =
    !isFullyScouted && isFocusTarget && Number.isFinite(focusSummary?.etaMatchdays)
      ? (focusSummary?.etaMatchdays as number)
      : null;

  const rosterPlayerIds = new Set(
    input.gameState.rosters.filter((entry) => entry.teamId === input.teamId).map((entry) => entry.playerId),
  );
  const rosterPlayers = input.gameState.players.filter((entry) => rosterPlayerIds.has(entry.id));
  const rosterAxisValues = rosterPlayers.map((entry) => entry.coreStats);
  const rosterDisciplineValues = rosterPlayers.map((entry) => ({ disciplineRatings: entry.disciplineRatings }));

  const topCount = Math.max(1, Math.min(input.topCount ?? 6, 6));
  const axisImpact = computeTopSixAxisImpact(rosterAxisValues, player.coreStats, topCount);
  const axisImpactBefore = computeCompositeTopSixAverage(axisImpact, "before");
  const axisImpactAfter = computeCompositeTopSixAverage(axisImpact, "after");
  const axisImpactComposite = {
    before: axisImpactBefore,
    after: axisImpactAfter,
    delta:
      axisImpactBefore != null && axisImpactAfter != null
        ? Number((axisImpactAfter - axisImpactBefore).toFixed(1))
        : null,
  };

  const disciplineNames = new Map(input.gameState.disciplines.map((entry) => [entry.id, entry.name] as const));
  const rankedOwnDisciplines = Object.entries(player.disciplineRatings ?? {}).sort((left, right) => right[1] - left[1]);
  const topDisciplineIds =
    player.preferredDisciplineIds && player.preferredDisciplineIds.length > 0
      ? player.preferredDisciplineIds
      : rankedOwnDisciplines.map(([disciplineId]) => disciplineId);
  const tierWindowLabel = effectiveScoutingLevel >= 4 ? "Exakt" : "Schätzung";
  const disciplineImpact = computeDisciplineTopSixImpact(
    rosterDisciplineValues,
    topDisciplineIds.slice(0, 3).map((disciplineId) => ({
      disciplineId,
      disciplineName: disciplineNames.get(disciplineId) ?? disciplineId,
      displayedScore: player.disciplineRatings?.[disciplineId] ?? null,
      tierWindow: tierWindowLabel,
    })),
    topCount,
  );

  const disciplineInputs = Object.entries(player.disciplineRatings ?? {}).map(([disciplineId, score]) => ({
    disciplineId,
    disciplineName: disciplineNames.get(disciplineId) ?? disciplineId,
    score,
  }));
  const disciplineTiers = buildScoutedDisciplineTiers({
    saveId: input.saveId,
    playerId: player.id,
    scoutingLevel: effectiveScoutingLevel,
    disciplines: disciplineInputs,
    topN: 5,
  });
  const disciplineSpecialties = (
    player.preferredDisciplineIds && player.preferredDisciplineIds.length > 0
      ? player.preferredDisciplineIds
      : disciplineTiers.map((entry) => entry.disciplineId)
  )
    .slice(0, 3)
    .map((disciplineId) => disciplineNames.get(disciplineId) ?? disciplineId);

  const starFields = buildScoutingWatchTargetStarFields({
    gameState: input.gameState,
    player,
    saveId: input.saveId,
    scoutingLevel: effectiveScoutingLevel,
  });
  const axisProfile = buildPlayerAxisStarProfile({
    gameState: input.gameState,
    player,
    disciplines: input.gameState.disciplines,
  });
  const revealedAxis = revealAxisStarProfile({
    profile: axisProfile,
    scoutingLevel: effectiveScoutingLevel,
  });

  const traitView = getScoutedTraitView({
    traitsPositive: player.traitsPositive ?? [],
    traitsNegative: player.traitsNegative ?? [],
    scoutingLevel: effectiveScoutingLevel,
  });

  const poPotentialRating =
    starFields.poMax != null
      ? starFields.poMax * 20
      : starFields.poMin != null
        ? starFields.poMin * 20
        : starFields.potentialScore ?? null;

  return {
    playerId: player.id,
    playerName: player.name,
    className: player.className,
    race: player.race,
    ageLabel: player.bracketLabel ?? null,
    disciplineSpecialties,
    marketValue: player.marketValue ?? null,
    salary: player.salaryDemand ?? null,
    certainty,
    effectiveScoutingLevel,
    neededCertainty,
    etaMatchdays,
    milestone: getScoutingIntelMilestone(certainty),
    isFocusTarget,
    isFullyScouted,
    impactIsExact: isScoutedImpactExact(certainty),
    axisOrbitStats: isFullyScouted ? player.coreStats : null,
    axisStars: {
      pow: revealedAxis.pow,
      spe: revealedAxis.spe,
      men: revealedAxis.men,
      soc: revealedAxis.soc,
    },
    axisDisplayLabel: revealedAxis.displayLabel,
    showAxisOrbit: isFullyScouted,
    showAxisStars: !isFullyScouted && effectiveScoutingLevel >= 3,
    axisImpact,
    axisImpactComposite,
    disciplineImpact,
    disciplineTiers,
    caDisplay: starFields.caDisplay ?? null,
    poDisplay: starFields.poDisplay ?? null,
    poPotentialRating,
    potentialBand: starFields.potentialBand ?? null,
    traits: {
      visiblePositive: traitView.visiblePositiveTraits,
      visibleNegative: traitView.visibleNegativeTraits,
      hiddenPositiveCount: traitView.hiddenPositiveTraitCount,
      hiddenNegativeCount: traitView.hiddenNegativeTraitCount,
    },
  };
}
