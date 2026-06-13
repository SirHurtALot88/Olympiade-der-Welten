import type {
  GameState,
  Player,
  PlayerPotentialBand,
  PlayerPotentialRecord,
  PlayerPotentialSource,
} from "@/lib/data/olyDataTypes";

export type PlayerPotentialCertainty = "missing_source" | "low" | "medium" | "high";

export type PlayerScoutPotential = {
  scoutRating: number | null;
  potentialRange: { min: number; max: number } | null;
  starRating: string;
  band: PlayerPotentialBand;
  certainty: PlayerPotentialCertainty;
  confidence: number;
  source: PlayerPotentialSource;
  scoutingLevel: number;
  trainingSpeedMultiplier: number;
  marketValuePotentialPremiumPct: number;
  salaryExpectationPremiumPct: number;
  ceilingMode: "soft_range_no_hard_ceiling";
  reasons: string[];
  warnings: string[];
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function roundValue(value: number, digits = 0) {
  return Number(value.toFixed(digits));
}

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeScoutingLevel(level: number | null | undefined) {
  if (!isFiniteNumber(level)) return 0;
  return clamp(Math.round(level), 0, 5);
}

function getScoutingUncertainty(level: number | null | undefined) {
  const normalizedLevel = normalizeScoutingLevel(level);
  if (normalizedLevel <= 0) return 16;
  if (normalizedLevel >= 5) return 3;
  if (normalizedLevel >= 4) return 4;
  if (normalizedLevel >= 3) return 6;
  if (normalizedLevel >= 2) return 8;
  return 10;
}

function getCertainty(level: number | null | undefined): PlayerPotentialCertainty {
  const confidence = getScoutingConfidencePct(level);
  if (confidence <= 0) return "missing_source";
  if (confidence >= 75) return "high";
  if (confidence >= 45) return "medium";
  return "low";
}

function getScoutingConfidencePct(level: number | null | undefined) {
  const normalizedLevel = normalizeScoutingLevel(level);
  if (normalizedLevel <= 0) return 20;
  if (normalizedLevel >= 5) return 90;
  if (normalizedLevel >= 4) return 82;
  if (normalizedLevel >= 3) return 70;
  if (normalizedLevel >= 2) return 55;
  return 35;
}

function getPotentialBand(potential: number): PlayerPotentialBand {
  if (potential >= 88) return "elite";
  if (potential >= 78) return "high";
  if (potential >= 62) return "medium";
  return "low";
}

function getStarRating(potential: number) {
  if (potential >= 94) return "5.0 Sterne";
  if (potential >= 88) return "4.5 Sterne";
  if (potential >= 80) return "4.0 Sterne";
  if (potential >= 72) return "3.5 Sterne";
  if (potential >= 64) return "3.0 Sterne";
  if (potential >= 56) return "2.5 Sterne";
  return "2.0 Sterne";
}

function getTrainingSpeedMultiplier(potential: number) {
  if (potential >= 94) return 1.18;
  if (potential >= 88) return 1.14;
  if (potential >= 80) return 1.09;
  if (potential >= 72) return 1.04;
  if (potential >= 58) return 1;
  return 0.94;
}

function getMarketValuePotentialPremiumPct(potential: number) {
  if (potential >= 94) return 22;
  if (potential >= 88) return 16;
  if (potential >= 80) return 10;
  if (potential >= 72) return 5;
  if (potential >= 58) return 0;
  return -4;
}

function getPlayerSeedValue(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

function getAverageAttributePotentialBase(player: Player) {
  const coreValues = Object.values(player.coreStats ?? {}).filter(isFiniteNumber);
  if (coreValues.length > 0) {
    return coreValues.reduce((sum, value) => sum + value, 0) / coreValues.length;
  }
  const disciplineValues = Object.values(player.disciplineRatings ?? {}).filter(
    (value): value is number => isFiniteNumber(value),
  );
  if (disciplineValues.length > 0) {
    return disciplineValues.reduce((sum, value) => sum + value, 0) / disciplineValues.length;
  }
  return 62;
}

function getTraitPotentialModifier(player: Pick<Player, "traitsPositive" | "traitsNegative">) {
  const positives = new Set((player.traitsPositive ?? []).map((entry) => entry.toLowerCase()));
  const negatives = new Set((player.traitsNegative ?? []).map((entry) => entry.toLowerCase()));
  let modifier = 0;
  for (const trait of ["ambitious", "diligent", "motivated", "disciplined", "flexible", "resourceful"]) {
    if (positives.has(trait)) modifier += 1.8;
  }
  for (const trait of ["lazy", "fainthearted", "paranoid", "renegade", "gambler", "obsessive"]) {
    if (negatives.has(trait)) modifier -= 1.6;
  }
  if (negatives.has("diva") || negatives.has("egomaniac")) modifier -= 0.8;
  return modifier;
}

function deriveHiddenPotentialScore(input: { saveId: string; player: Player }) {
  const base = getAverageAttributePotentialBase(input.player);
  const importedPotential = isFiniteNumber(input.player.potential) && input.player.potential > 0 ? input.player.potential : null;
  const seed = getPlayerSeedValue(`${input.saveId}:${input.player.id}:potential-v1`);
  const jitter = (seed - 0.5) * 16;
  const baseline = importedPotential == null ? base + 8 : importedPotential * 0.72 + (base + 8) * 0.28;
  return roundValue(clamp(baseline + getTraitPotentialModifier(input.player) + jitter, 35, 99), 0);
}

export function buildPlayerPotentialRecord(input: {
  saveId: string;
  player: Player;
  existing?: PlayerPotentialRecord | null;
}): PlayerPotentialRecord {
  if (input.existing?.hiddenPotentialScore != null) {
    return input.existing;
  }
  const importedPotential = isFiniteNumber(input.player.potential) && input.player.potential > 0 ? input.player.potential : null;
  const hiddenPotentialScore = importedPotential ?? deriveHiddenPotentialScore(input);
  return {
    playerId: input.player.id,
    potentialBand: getPotentialBand(hiddenPotentialScore),
    hiddenPotentialScore,
    revealedPotentialRange: undefined,
    confidence: 0,
    source: importedPotential == null ? "generated" : "imported",
  };
}

export function buildPlayerPotentialRecordsForSave(input: { saveId: string; players: Player[] }) {
  return input.players.map((player) => buildPlayerPotentialRecord({ saveId: input.saveId, player }));
}

function resolvePlayerPotentialRecord(input: {
  gameState?: GameState | null;
  player: Player;
  saveId?: string | null;
}) {
  const existing = input.gameState?.playerPotential?.find((entry) => entry.playerId === input.player.id) ?? null;
  return buildPlayerPotentialRecord({
    saveId: input.saveId ?? input.gameState?.season.id ?? "local-save",
    player: input.player,
    existing,
  });
}

function buildScoutPotentialFromScore(input: {
  potentialScore: number | null;
  scoutingLevel?: number | null;
  source: PlayerPotentialSource;
  sourceWarning?: string | null;
}): PlayerScoutPotential {
  const scoutingLevel = normalizeScoutingLevel(input.scoutingLevel);
  if (!isFiniteNumber(input.potentialScore) || input.potentialScore <= 0) {
    return {
      scoutRating: null,
      potentialRange: null,
      starRating: "-",
      band: "unknown",
      certainty: "missing_source",
      confidence: 0,
      source: "missing",
      scoutingLevel,
      trainingSpeedMultiplier: 1,
      marketValuePotentialPremiumPct: 0,
      salaryExpectationPremiumPct: 0,
      ceilingMode: "soft_range_no_hard_ceiling",
      reasons: ["potential_source_missing"],
      warnings: ["potential_source_missing"],
    };
  }

  const hiddenPotential = roundValue(clamp(input.potentialScore, 1, 99), 0);
  const uncertainty = getScoutingUncertainty(scoutingLevel);
  const potentialRange = {
    min: roundValue(clamp(hiddenPotential - uncertainty, 35, 99), 0),
    max: roundValue(clamp(hiddenPotential + uncertainty, 35, 99), 0),
  };
  const scoutRating = roundValue((potentialRange.min + potentialRange.max) / 2, 0);
  const band = getPotentialBand(scoutRating);
  const trainingSpeedMultiplier = getTrainingSpeedMultiplier(hiddenPotential);
  const marketValuePotentialPremiumPct = getMarketValuePotentialPremiumPct(hiddenPotential);
  const reasons = ["soft_potential_range_no_hard_ceiling"];
  if (input.source === "generated") reasons.push("save_seed_generated_potential");
  if (input.source === "imported") reasons.push("imported_potential_source");
  if (band === "elite") reasons.push("high_potential_training_acceleration");
  if (band === "high") reasons.push("above_average_potential");
  if (band === "low") reasons.push("limited_scouted_upside");
  if (trainingSpeedMultiplier !== 1) reasons.push("potential_training_speed_modifier");
  if (marketValuePotentialPremiumPct > 0) reasons.push("market_value_potential_premium_preview");
  if (uncertainty >= 10) reasons.push("wide_scouting_range");

  return {
    scoutRating,
    potentialRange,
    starRating: getStarRating(scoutRating),
    band,
    certainty: getCertainty(scoutingLevel),
    confidence: getScoutingConfidencePct(scoutingLevel),
    source: input.source,
    scoutingLevel,
    trainingSpeedMultiplier,
    marketValuePotentialPremiumPct,
    salaryExpectationPremiumPct: roundValue(marketValuePotentialPremiumPct * 0.5, 1),
    ceilingMode: "soft_range_no_hard_ceiling",
    reasons,
    warnings: [uncertainty >= 10 ? "potential_range_uncertain" : null, input.sourceWarning].filter(
      (entry): entry is string => Boolean(entry),
    ),
  };
}

export function revealPlayerPotentialRecord(input: {
  record: PlayerPotentialRecord;
  scoutingLevel?: number | null;
}): PlayerPotentialRecord {
  const scoutPotential = buildScoutPotentialFromScore({
    potentialScore: input.record.hiddenPotentialScore ?? null,
    scoutingLevel: input.scoutingLevel,
    source: input.record.source,
    sourceWarning: input.record.source === "missing" ? "potential_source_missing" : null,
  });
  return {
    ...input.record,
    potentialBand: scoutPotential.band,
    revealedPotentialRange: scoutPotential.potentialRange ?? undefined,
    confidence: scoutPotential.confidence,
    source: normalizeScoutingLevel(input.scoutingLevel) > 0 && scoutPotential.source !== "missing"
      ? "scouted"
      : input.record.source,
  };
}

export function buildPlayerScoutPotential(input: {
  player: Pick<Player, "potential">;
  scoutingLevel?: number | null;
}): PlayerScoutPotential {
  if (!isFiniteNumber(input.player.potential) || input.player.potential <= 0) {
    return {
      scoutRating: null,
      potentialRange: null,
      starRating: "-",
      band: "unknown",
      certainty: "missing_source",
      confidence: 0,
      source: "missing",
      scoutingLevel: normalizeScoutingLevel(input.scoutingLevel),
      trainingSpeedMultiplier: 1,
      marketValuePotentialPremiumPct: 0,
      salaryExpectationPremiumPct: 0,
      ceilingMode: "soft_range_no_hard_ceiling",
      reasons: ["potential_source_missing"],
      warnings: ["potential_source_missing"],
    };
  }

  return buildScoutPotentialFromScore({
    potentialScore: input.player.potential,
    scoutingLevel: input.scoutingLevel,
    source: "imported",
  });
}

export function buildPlayerScoutPotentialFromGameState(input: {
  gameState?: GameState | null;
  player: Player;
  saveId?: string | null;
  scoutingLevel?: number | null;
}): PlayerScoutPotential {
  const record = resolvePlayerPotentialRecord(input);
  return buildScoutPotentialFromScore({
    potentialScore: record.hiddenPotentialScore ?? null,
    scoutingLevel: input.scoutingLevel,
    source: record.source,
    sourceWarning: record.source === "missing" ? "potential_source_missing" : null,
  });
}
