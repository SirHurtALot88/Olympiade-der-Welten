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

/** Deterministischer PRNG (FNV-Hash → xorshift), stabil pro Seed. */
function createSeededRandom(seed: string): () => number {
  let state = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    state ^= seed.charCodeAt(index);
    state = Math.imul(state, 16777619);
  }
  state = state >>> 0 || 1;
  return () => {
    state = Math.imul(state ^ (state >>> 15), 1 | state);
    state ^= state + Math.imul(state ^ (state >>> 7), 61 | state);
    return ((state ^ (state >>> 14)) >>> 0) / 4294967296;
  };
}

// Gesamt-Unschärfe (in Wertepunkten) auf dem Attribut-Max bei confidence=0. Bei
// confidence=100 ist die Spanne 0 (exakter Wert). Bei den Reveal-Gains (eigene +5,
// Watchlist +10, Free Agents +0.5 pro Matchday) entspricht das ~1 / ~2 / ~0.1
// aufgedeckten Punkten pro Spieltag.
const FOG_FULL_WIDTH = 20;

/**
 * Fog-Range auf ein Attribut-Max. Wichtig: der ECHTE Wert liegt NIE zentriert in der
 * Spanne (sonst wäre der Mittelwert = der Wert und die Verschleierung sinnlos). Der
 * Wert sitzt an einer zufälligen, deterministischen Position; pro aufgedecktem Punkt
 * (≈ pro Spieltag) rückt eine ZUFÄLLIGE Seite um 1 näher heran — pro Attribut eigen.
 */
function computeFoggedCeilingRange(input: {
  ceiling: number;
  floor: number;
  playerId: string;
  attribute: string;
  confidence: number;
}): { min: number; max: number; revealed: boolean } {
  const { ceiling, floor, playerId, attribute } = input;
  const conf = Math.min(100, Math.max(0, input.confidence)) / 100;
  const removed = Math.round(conf * FOG_FULL_WIDTH);
  if (removed >= FOG_FULL_WIDTH) {
    return { min: ceiling, max: ceiling, revealed: true };
  }

  // Asymmetrische Startaufteilung: Position des echten Werts in der Spanne, nie
  // in der Mitte (mindestens ~8% vom Zentrum entfernt).
  let posFrac = 0.18 + 0.64 * createSeededRandom(`fog-pos:${playerId}:${attribute}`)();
  if (Math.abs(posFrac - 0.5) < 0.08) posFrac += posFrac < 0.5 ? -0.12 : 0.12;
  let marginLow = Math.round(FOG_FULL_WIDTH * posFrac);
  let marginHigh = FOG_FULL_WIDTH - marginLow;

  // Pro aufgedecktem Punkt: von einer zufälligen Seite 1 Punkt näher. Erreicht eine
  // Seite 0, geht der Rest an die andere. FOG_FULL_WIDTH ist klein → Loop ist billig.
  const sideRandom = createSeededRandom(`fog-side:${playerId}:${attribute}`);
  for (let step = 0; step < removed; step += 1) {
    const pickLow = sideRandom() < 0.5;
    if (pickLow && marginLow > 0) marginLow -= 1;
    else if (marginHigh > 0) marginHigh -= 1;
    else if (marginLow > 0) marginLow -= 1;
  }

  const min = Math.min(99, Math.max(floor, ceiling - marginLow));
  const max = Math.min(99, Math.max(min, ceiling + marginHigh));
  return { min, max, revealed: min === max };
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

  // Reveal-Confidence (0..100): wie sicher der Attribut-Max bekannt ist. Wächst rein über
  // die Zeit (record.confidence, per Auto-Reveal-Tick — eigene Spieler schneller). Kein
  // Sofort-Bonus: ein frischer Spieler startet VOLL verschleiert (breiteste Range).
  const revealConfidence = record.confidence ?? 0;

  const attributeCeilingPreview: PlayerAttributeCeilingPreview[] = playerGeneratorAttributeKeys.map((attribute) => {
    const headroom = getAttributeHeadroom({ player: input.player, attribute, record });
    // Fog-Range auf den Max: echter Wert NIE zentriert, deckt sich pro Spieltag von
    // einer zufälligen Seite auf (siehe computeFoggedCeilingRange).
    const range =
      headroom.ceiling == null
        ? null
        : computeFoggedCeilingRange({
            ceiling: headroom.ceiling,
            floor: headroom.current ?? 1,
            playerId: input.player.id,
            attribute,
            confidence: revealConfidence,
          });
    return {
      attribute,
      label: TRAINING_ATTRIBUTE_LABELS[attribute],
      current: headroom.current,
      ceiling: headroom.ceiling,
      ceilingMin: range?.min ?? null,
      ceilingMax: range?.max ?? null,
      ceilingRevealed: range?.revealed ?? true,
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
