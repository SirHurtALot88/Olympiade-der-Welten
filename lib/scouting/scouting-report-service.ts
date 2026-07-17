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
import type { TransfermarktRatingTier } from "@/lib/market/transfermarkt-sheet-stats";
import {
  getEffectiveScoutingLevel,
  getFullRevealCertaintyThreshold,
  getPlayerScoutCertainty,
  getScoutFocusSummary,
} from "@/lib/scouting/facility-scout-pipeline-service";
import { getScoutingIntelMilestone } from "@/lib/scouting/scouting-hub-targets-service";
import { buildPlayerAxisStarProfile, revealAxisStarProfile } from "@/lib/scouting/player-axis-star-rating";
import { buildScoutingWatchTargetStarFields } from "@/lib/scouting/player-star-scouting-bridge";
import { DEBUG_FORCE_PLAYER_VISIBILITY } from "@/lib/foundation/debug-player-visibility";

export type ScoutingReportDisciplineTier = {
  disciplineId: string;
  disciplineName: string;
  displayedScore: number;
  scoreTier: TransfermarktRatingTier | null;
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
  /** Absolute current rating (0..99). Feeds the shared CA→stars scale (matches PO/roster/drawer). */
  caRating: number | null;
  caDisplay: string | null;
  poDisplay: string | null;
  poPotentialRating: number | null;
  poStarMin: number | null;
  poStarMax: number | null;
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
/** Absolute current rating for the shared CA→stars scale: OVR → rating → mean of core stats. */
function resolveAbsoluteCurrentRating(player: GameState["players"][number]): number | null {
  if (typeof player.ovr === "number" && Number.isFinite(player.ovr)) return player.ovr;
  if (typeof player.rating === "number" && Number.isFinite(player.rating)) return player.rating;
  const coreValues = Object.values(player.coreStats ?? {}).filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value),
  );
  if (coreValues.length === 0) return null;
  return coreValues.reduce((sum, value) => sum + value, 0) / coreValues.length;
}

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
  const neededCertainty = getFullRevealCertaintyThreshold(facilityLevel);
  // Build-Phase-Override: `DEBUG_FORCE_PLAYER_VISIBILITY` überbrückt den Fog of
  // War auch hier — solange der Schalter AN ist, wird JEDER Report als
  // vollständig gescoutet behandelt (Level 5 / 100% Intel), damit die
  // Scouting-Mitte exakte Werte statt gestreuter Bänder zeigt. Alles unten
  // (Tiers, Achsen-Orbit, Traits, PO-Range) leitet sich aus diesen beiden
  // Größen ab, daher genügt es, sie an der Wurzel zu forcieren.
  const certainty = DEBUG_FORCE_PLAYER_VISIBILITY
    ? Math.max(neededCertainty, 100)
    : getPlayerScoutCertainty(input.gameState, input.teamId, input.playerId);
  const effectiveScoutingLevel = DEBUG_FORCE_PLAYER_VISIBILITY
    ? 5
    : getEffectiveScoutingLevel(input.gameState, input.teamId, input.playerId);
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
    caRating: resolveAbsoluteCurrentRating(player),
    caDisplay: starFields.caDisplay ?? null,
    poDisplay: starFields.poDisplay ?? null,
    poPotentialRating,
    poStarMin: starFields.poMin ?? null,
    poStarMax: starFields.poMax ?? null,
    potentialBand: starFields.potentialBand ?? null,
    traits: {
      visiblePositive: traitView.visiblePositiveTraits,
      visibleNegative: traitView.visibleNegativeTraits,
      hiddenPositiveCount: traitView.hiddenPositiveTraitCount,
      hiddenNegativeCount: traitView.hiddenNegativeTraitCount,
    },
  };
}
