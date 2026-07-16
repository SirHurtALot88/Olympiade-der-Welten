import type { GameState, RosterEntry } from "@/lib/data/olyDataTypes";
import { assessPlayerMorale } from "@/lib/morale/player-morale-service";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function round(value: number, digits = 3) {
  return Number(value.toFixed(digits));
}

export type PlayerMoralePerformanceSignal = {
  morale: number;
  multiplier: number;
  modifierPct: number;
  label: "boost" | "neutral" | "risk";
  contractDragPct: number;
};

export function calculatePlayerMoralePerformanceSignal(input: {
  morale: number | null | undefined;
  contractLength?: number | null;
}): PlayerMoralePerformanceSignal {
  const morale = clamp(typeof input.morale === "number" && Number.isFinite(input.morale) ? input.morale : 50, 0, 100);
  const positivePct = morale >= 50 ? ((morale - 50) / 50) * 8 : 0;
  const negativePct = morale < 50 ? -((50 - morale) / 50) * 8 : 0;
  const contractDragPct =
    morale < 30 && (input.contractLength ?? 0) >= 4
      ? -2
      : morale < 35 && (input.contractLength ?? 0) >= 3
        ? -1
        : 0;
  const modifierPct = round(clamp(positivePct + negativePct + contractDragPct, -10, 8), 1);

  return {
    morale: round(morale, 1),
    multiplier: round(1 + modifierPct / 100, 4),
    modifierPct,
    label: modifierPct > 0.3 ? "boost" : modifierPct < -0.3 ? "risk" : "neutral",
    contractDragPct,
  };
}

export function buildPlayerMoralePerformanceMap(input: {
  gameState: GameState | null | undefined;
  teamId: string;
  rosterEntries?: RosterEntry[] | null;
}): Record<string, PlayerMoralePerformanceSignal> | null {
  if (!input.gameState) {
    return null;
  }

  const rosterEntries = input.rosterEntries ?? input.gameState.rosters.filter((entry) => entry.teamId === input.teamId);
  const signals: Record<string, PlayerMoralePerformanceSignal> = {};

  for (const rosterEntry of rosterEntries) {
    const morale = assessPlayerMorale({
      gameState: input.gameState,
      playerId: rosterEntry.playerId,
      teamId: rosterEntry.teamId,
    });
    signals[rosterEntry.playerId] = calculatePlayerMoralePerformanceSignal({
      morale: morale?.morale ?? 50,
      contractLength: rosterEntry.contractLength,
    });
  }

  return signals;
}
