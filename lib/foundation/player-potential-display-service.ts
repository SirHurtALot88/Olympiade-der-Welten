import type { GameState, Player, PlayerPotentialRecord } from "@/lib/data/olyDataTypes";
import type { PlayerAxisKey } from "@/lib/scouting/player-axis-star-rating";
import { buildPlayerAxisStarProfile } from "@/lib/scouting/player-axis-star-rating";
import {
  getAttributeGrowthMultiplier,
  getAttributeHeadroom,
  getAttributesForAxis,
  getAxisRouteLabel,
  getAxisRouteState,
  getAxisRouteTrainingMultiplier,
  getHeadroomLabel,
  type AttributeHeadroomState,
  type AxisRouteState,
} from "@/lib/scouting/player-attribute-ceiling-service";
import { buildPlayerPotentialRecord } from "@/lib/progression/player-potential-service";
import { clampPotentialCeilingToCurrentStars } from "@/lib/scouting/player-potential-ceiling-service";
import { playerGeneratorAttributeKeys } from "@/lib/player-generator/official-discipline-weights";
import type { PlayerGeneratorAttributeName } from "@/lib/data/olyDataTypes";
import { TRAINING_ATTRIBUTE_LABELS } from "@/lib/training/training-levelup-service";

const AXIS_LABELS: Record<PlayerAxisKey, string> = {
  pow: "POW",
  spe: "SPE",
  men: "MEN",
  soc: "SOC",
};

export type PlayerPotentialAxisStatus = {
  axis: PlayerAxisKey;
  caStars: number;
  poStars: number;
  deltaStars: number | null;
  routeState: AxisRouteState;
  label: string;
};

export type PlayerAttributeCeilingPreview = {
  attribute: PlayerGeneratorAttributeName;
  label: string;
  current: number | null;
  state: AttributeHeadroomState;
  headroomLabel: string;
  growthMultiplier: number;
};

export type PlayerTrainingRouteImpact = {
  primaryAxis: PlayerAxisKey;
  growthMultiplier: number;
  note: string;
};

export type PlayerPotentialDisplaySnapshot = {
  potentialOverallStars: number | null;
  potentialOverallDelta: number | null;
  potentialOverallDeltaSourceLabel: string | null;
  potentialAxisStatus: PlayerPotentialAxisStatus[];
  attributeCeilingPreview: PlayerAttributeCeilingPreview[];
  trainingRouteImpact: PlayerTrainingRouteImpact | null;
};

function roundHalf(value: number) {
  return Math.round(value * 2) / 2;
}

function resolveRecord(input: {
  gameState: GameState;
  player: Player;
  saveId: string;
}): PlayerPotentialRecord {
  return (
    input.gameState.playerPotential?.find((entry) => entry.playerId === input.player.id) ??
    buildPlayerPotentialRecord({ saveId: input.saveId, player: input.player })
  );
}

export function buildPlayerPotentialDisplaySnapshot(input: {
  gameState: GameState;
  player: Player;
  saveId: string;
}): PlayerPotentialDisplaySnapshot {
  const record = resolveRecord(input);
  const currentStars = buildPlayerAxisStarProfile({
    gameState: input.gameState,
    player: input.player,
    disciplines: input.gameState.disciplines,
  });
  const rawCeiling =
    record.hiddenPotentialCeilingByAxis && record.hiddenPotentialOverallStars != null
      ? {
          pow: record.hiddenPotentialCeilingByAxis.pow,
          spe: record.hiddenPotentialCeilingByAxis.spe,
          men: record.hiddenPotentialCeilingByAxis.men,
          soc: record.hiddenPotentialCeilingByAxis.soc,
          overall: record.hiddenPotentialOverallStars,
        }
      : null;
  const ceiling = rawCeiling ? clampPotentialCeilingToCurrentStars(currentStars, rawCeiling) : null;
  const axisPo = ceiling
    ? {
        pow: ceiling.pow,
        spe: ceiling.spe,
        men: ceiling.men,
        soc: ceiling.soc,
      }
    : null;
  const overallPo = ceiling?.overall ?? null;
  const snapshot = record.lastSeasonSnapshot ?? null;

  const potentialAxisStatus: PlayerPotentialAxisStatus[] = (["pow", "spe", "men", "soc"] as const).map((axis) => {
    const caStars = currentStars[axis];
    const poStars = axisPo?.[axis] ?? caStars;
    const deltaStars =
      snapshot?.byAxis[axis] != null ? roundHalf(poStars - snapshot.byAxis[axis]) : null;
    const routeState = getAxisRouteState({ caStars, poStars });
    const gapStars = Math.max(0, poStars - caStars);
    return {
      axis,
      caStars,
      poStars,
      deltaStars,
      routeState,
      label: getAxisRouteLabel(routeState, gapStars),
    };
  });

  const attributeCeilingPreview: PlayerAttributeCeilingPreview[] = playerGeneratorAttributeKeys.map((attribute) => {
    const headroom = getAttributeHeadroom({ player: input.player, attribute, record });
    return {
      attribute,
      label: TRAINING_ATTRIBUTE_LABELS[attribute],
      current: headroom.current,
      state: headroom.state,
      headroomLabel: getHeadroomLabel(headroom.state, headroom.headroom),
      growthMultiplier: getAttributeGrowthMultiplier(headroom.state),
    };
  });

  const sortedAxes = [...potentialAxisStatus].sort((left, right) => right.caStars - left.caStars);
  const primaryAxis = sortedAxes[0]?.axis ?? "pow";
  const primaryStatus = potentialAxisStatus.find((entry) => entry.axis === primaryAxis)!;
  const routeMultiplier = getAxisRouteTrainingMultiplier(primaryStatus.routeState);
  const cappedAxes = potentialAxisStatus.filter((entry) => entry.routeState === "capped").map((entry) => AXIS_LABELS[entry.axis]);
  const openAxes = potentialAxisStatus
    .filter((entry) => entry.routeState === "open")
    .map((entry) => {
      const attrs = getAttributesForAxis(entry.axis).slice(0, 2).map((attr) => TRAINING_ATTRIBUTE_LABELS[attr]).join("/");
      return `${AXIS_LABELS[entry.axis]} (${attrs})`;
    });

  let note = `${AXIS_LABELS[primaryAxis]}-Route ×${routeMultiplier.toFixed(2)}`;
  if (cappedAxes.length > 0) {
    note = `${cappedAxes.join(", ")} am Limit`;
    if (openAxes.length > 0) note += ` — Fokus ${openAxes.join(", ")}`;
  }

  return {
    potentialOverallStars: overallPo,
    potentialOverallDelta:
      snapshot?.overallStars != null && overallPo != null
        ? roundHalf(overallPo - snapshot.overallStars)
        : null,
    potentialOverallDeltaSourceLabel: snapshot ? `Vergleich zu Saison ${snapshot.seasonId}` : null,
    potentialAxisStatus,
    attributeCeilingPreview,
    trainingRouteImpact: {
      primaryAxis,
      growthMultiplier: routeMultiplier,
      note,
    },
  };
}

export function getPotentialGapXpFactor(gapStars: number) {
  if (gapStars >= 1.5) return 1.18;
  if (gapStars >= 0.75) return 1.08;
  if (gapStars >= 0.25) return 0.95;
  return 0.72;
}

export function getCombinedAttributeTrainingMultiplier(input: {
  player: Player;
  attribute: PlayerGeneratorAttributeName;
  record?: PlayerPotentialRecord | null;
  axisCaStars?: Record<PlayerAxisKey, number> | null;
  axisPoStars?: Record<PlayerAxisKey, number> | null;
  affinityGrowthMultiplier?: number;
}) {
  const headroom = getAttributeHeadroom({
    player: input.player,
    attribute: input.attribute,
    record: input.record,
  });
  const attributeMult = getAttributeGrowthMultiplier(headroom.state);
  const axis = (["pow", "spe", "men", "soc"] as const).find((entry) =>
    getAttributesForAxis(entry).includes(input.attribute),
  ) ?? "pow";
  const caStars = input.axisCaStars?.[axis] ?? 2.5;
  const poStars = input.axisPoStars?.[axis];
  const routeMult =
    poStars != null
      ? getAxisRouteTrainingMultiplier(getAxisRouteState({ caStars, poStars }))
      : 1;
  return (input.affinityGrowthMultiplier ?? 1) * attributeMult * routeMult;
}
