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
  deriveAxisPoStarsFromAttributeCeilings,
  type AttributeHeadroomState,
  type AxisRouteState,
} from "@/lib/scouting/player-attribute-ceiling-service";
import { buildPlayerPotentialRecord, potentialScoreToStars } from "@/lib/progression/player-potential-service";
import { clampPotentialCeilingToCurrentStars, reconcilePlayerPotentialRecordToCurrentAbility } from "@/lib/scouting/player-potential-ceiling-service";
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
  /** Max erreichbarer Attributwert (Potenzial-Decke), numerisch. */
  ceiling: number | null;
  /**
   * Fog-of-War-Unschärfe auf den Max: solange das Potenzial nicht voll aufgedeckt
   * ist, wird der Max als Bereich [ceilingMin, ceilingMax] gezeigt (breit bei niedriger
   * Reveal-Confidence, eng bei hoher). Bei voller Aufdeckung gilt ceilingRevealed=true
   * und min=max=ceiling (exakter Wert).
   */
  ceilingMin: number | null;
  ceilingMax: number | null;
  ceilingRevealed: boolean;
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
  const reconciledRecord = reconcilePlayerPotentialRecordToCurrentAbility({
    player: input.player,
    record,
    currentStars,
    saveId: input.saveId,
  });
  const rawCeiling =
    reconciledRecord.hiddenPotentialCeilingByAxis && reconciledRecord.hiddenPotentialOverallStars != null
      ? {
          pow: reconciledRecord.hiddenPotentialCeilingByAxis.pow,
          spe: reconciledRecord.hiddenPotentialCeilingByAxis.spe,
          men: reconciledRecord.hiddenPotentialCeilingByAxis.men,
          soc: reconciledRecord.hiddenPotentialCeilingByAxis.soc,
          overall: reconciledRecord.hiddenPotentialOverallStars,
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
  // GESAMT-Potenzial-Stern aus dem echten Potenzial-Score (nicht dem aufgeblähten
  // Achsen-Ceiling), damit Profil-Header, Kader, Scouting & Spielerliste denselben
  // PO-Stern zeigen. Achsen-Detail (axisPo) bleibt unberührt.
  const overallPo =
    reconciledRecord.hiddenPotentialScore != null
      ? roundHalf(Math.max(currentStars.overall, potentialScoreToStars(reconciledRecord.hiddenPotentialScore)))
      : ceiling?.overall ?? null;
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

  // Reveal-Confidence (0..1): wie sicher der Attribut-Max bekannt ist. Wächst rein über
  // die Zeit (record.confidence, per Auto-Reveal-Tick — eigene Spieler schneller). Kein
  // Sofort-Bonus: ein frischer Spieler startet VOLL verschleiert (breiteste Range) und
  // deckt sich erst über die Saison auf (~1 Genauigkeits-Schritt pro Matchday).
  const potentialRevealConfidence = Math.min(1, Math.max(0, (record.confidence ?? 0) / 100));
  const POTENTIAL_CEILING_BAND_MAX = 13;

  const attributeCeilingPreview: PlayerAttributeCeilingPreview[] = playerGeneratorAttributeKeys.map((attribute) => {
    const headroom = getAttributeHeadroom({ player: input.player, attribute, record });
    // Fog-Unschärfe auf den Max: Bandbreite skaliert mit (1 − Reveal-Confidence).
    const band = Math.round((1 - potentialRevealConfidence) * POTENTIAL_CEILING_BAND_MAX);
    const floor = headroom.current ?? 1;
    const ceilingRevealed = headroom.ceiling == null || band <= 1;
    const ceilingMin =
      headroom.ceiling == null
        ? null
        : ceilingRevealed
          ? headroom.ceiling
          : Math.min(99, Math.max(floor, Math.round(headroom.ceiling - band)));
    const ceilingMax =
      headroom.ceiling == null
        ? null
        : ceilingRevealed
          ? headroom.ceiling
          : Math.min(99, Math.max(floor, Math.round(headroom.ceiling + band)));
    return {
      attribute,
      label: TRAINING_ATTRIBUTE_LABELS[attribute],
      current: headroom.current,
      ceiling: headroom.ceiling,
      ceilingMin,
      ceilingMax,
      ceilingRevealed,
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
  const axisPoFromAttributes =
    input.record?.hiddenAttributeCeiling &&
    Object.values(input.record.hiddenAttributeCeiling).some((value) => typeof value === "number" && Number.isFinite(value))
      ? deriveAxisPoStarsFromAttributeCeilings(input.record.hiddenAttributeCeiling)
      : null;
  const poStars = axisPoFromAttributes?.[axis] ?? input.axisPoStars?.[axis] ?? input.record?.hiddenPotentialCeilingByAxis?.[axis];
  const effectivePoStars = poStars != null ? Math.max(poStars, caStars) : null;
  const routeMult =
    effectivePoStars != null
      ? getAxisRouteTrainingMultiplier(getAxisRouteState({ caStars, poStars: effectivePoStars }))
      : 1;
  return (input.affinityGrowthMultiplier ?? 1) * attributeMult * routeMult;
}
