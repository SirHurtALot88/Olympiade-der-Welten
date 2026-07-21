import type { GameState, Player } from "@/lib/data/olyDataTypes";
import {
  buildPlayerAxisStarProfile,
  revealAxisStarProfile,
  type PlayerAxisStarProfile,
  type RevealedAxisStarProfile,
} from "@/lib/scouting/player-axis-star-rating";
import {
  buildPlayerPotentialCeilingProfile,
  revealPotentialStars,
  type PlayerPotentialCeilingProfile,
  type RevealedPotentialStars,
} from "@/lib/scouting/player-potential-ceiling-service";
import {
  buildPlayerPotentialRecord,
  potentialScoreToStars,
} from "@/lib/progression/player-potential-service";

export type PlayerStarScoutingSnapshot = {
  currentStars: PlayerAxisStarProfile;
  revealedCurrentStars: RevealedAxisStarProfile;
  potentialCeiling: PlayerPotentialCeilingProfile;
  revealedPotentialStars: RevealedPotentialStars;
  potentialGap: number;
  fairValueRatio: number | null;
};

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function estimateFairValueFromStars(overallStars: number, marketValue: number | null | undefined) {
  if (!isFiniteNumber(marketValue) || marketValue <= 0) return null;
  const baselineStars = 2.5;
  return marketValue * (overallStars / baselineStars);
}

export function buildPlayerStarScoutingSnapshot(input: {
  gameState: GameState;
  player: Player;
  saveId: string;
  scoutingLevel: number;
}): PlayerStarScoutingSnapshot {
  const currentStars = buildPlayerAxisStarProfile({
    gameState: input.gameState,
    player: input.player,
    disciplines: input.gameState.disciplines,
  });
  const existingRecord =
    input.gameState.playerPotential?.find((entry) => entry.playerId === input.player.id) ?? null;
  const baseRecord = buildPlayerPotentialRecord({
    saveId: input.saveId,
    player: input.player,
    existing: existingRecord,
  });
  const potentialCeiling = buildPlayerPotentialCeilingProfile({
    saveId: input.saveId,
    player: input.player,
    currentStars,
    hiddenPotentialScore: baseRecord.hiddenPotentialScore,
    existing: existingRecord,
  });

  const revealedCurrentStars = revealAxisStarProfile({
    profile: currentStars,
    scoutingLevel: input.scoutingLevel,
  });
  // Der GESAMT-Potenzial-Stern kommt aus dem echten Potenzial-Score, nicht aus dem
  // aufgeblähten Achsen-Ceiling (siehe revealPotentialStars.overallStarsOverride). So zeigen
  // Kader, Scouting, Transfermarkt, Spielerliste & Profil überall denselben PO-Stern.
  const potentialOverallStars =
    baseRecord.hiddenPotentialScore != null ? potentialScoreToStars(baseRecord.hiddenPotentialScore) : null;
  const revealedPotentialStars = revealPotentialStars({
    ceiling: potentialCeiling,
    currentStars,
    scoutingLevel: input.scoutingLevel,
    overallStarsOverride: potentialOverallStars,
    seed: input.player.id,
  });
  const overallForGap = potentialOverallStars ?? currentStars.overall;
  const potentialGap = Math.min(
    5,
    Math.max(0, Math.round((overallForGap - currentStars.overall) * 2) / 2),
  );
  const fairValue = estimateFairValueFromStars(
    currentStars.overall,
    input.player.marketValue ?? null,
  );
  const fairValueRatio =
    fairValue != null && isFiniteNumber(input.player.marketValue) && input.player.marketValue > 0
      ? input.player.marketValue / fairValue
      : null;

  return {
    currentStars,
    revealedCurrentStars,
    potentialCeiling,
    revealedPotentialStars,
    potentialGap,
    fairValueRatio,
  };
}

/** Compact CA/PO fields for scouting hub watchlist cards. */
export function buildScoutingWatchTargetStarFields(input: {
  gameState: GameState;
  player: Player;
  saveId: string;
  scoutingLevel: number;
}) {
  const snapshot = buildPlayerStarScoutingSnapshot(input);
  const record =
    input.gameState.playerPotential?.find((entry) => entry.playerId === input.player.id) ?? null;
  const potentialRecord = buildPlayerPotentialRecord({
    saveId: input.saveId,
    player: input.player,
    existing: record,
  });

  return {
    caOverall: snapshot.currentStars.overall,
    caPow: snapshot.currentStars.pow,
    caSpe: snapshot.currentStars.spe,
    caMen: snapshot.currentStars.men,
    caSoc: snapshot.currentStars.soc,
    caDisplay: snapshot.revealedCurrentStars.displayLabel,
    poDisplay: snapshot.revealedPotentialStars.displayLabel,
    poMin: snapshot.revealedPotentialStars.overallMin,
    poMax: snapshot.revealedPotentialStars.overallMax,
    poPow: snapshot.potentialCeiling.pow,
    poSpe: snapshot.potentialCeiling.spe,
    poMen: snapshot.potentialCeiling.men,
    poSoc: snapshot.potentialCeiling.soc,
    potentialGap: snapshot.potentialGap,
    potentialScore: potentialRecord.hiddenPotentialScore ?? null,
    potentialBand: potentialRecord.potentialBand ?? null,
  };
}
