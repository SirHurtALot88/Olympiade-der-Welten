import type { GameState } from "@/lib/data/olyDataTypes";

/** Ein Punkt des Belastungsverlaufs: Erschöpfung (0..100) eines Spielers vor dem Einsatz an einem Spieltag. */
export type BelastungsPunkt = { matchdayId: string; spieltag: number | null; wert: number };

/**
 * Belastung je Spieltag der laufenden Saison. Nichts Neues gespeichert: jeder Einsatz schreibt seinen Verletzungswurf in
 * `seasonState.injuryEvents`, und dessen `fatigueBefore` ist die Belastung vor dem Spieltag (gesunde Würfe bleiben dafür erhalten,
 * siehe `InjuryEventRecord`). Ohne Einsatz an einem Spieltag gibt es dort keinen Punkt.
 */
export function baueBelastungsVerlauf(gameState: GameState, playerId: string): BelastungsPunkt[] {
  const ids = gameState.season?.matchdayIds ?? [];
  const seasonId = gameState.season?.id;
  const jeSpieltag = new Map<string, number>();
  for (const e of gameState.seasonState?.injuryEvents ?? []) {
    if (e.playerId !== playerId || (seasonId && e.seasonId !== seasonId)) continue;
    jeSpieltag.set(e.matchdayId, e.fatigueBefore);
  }
  return [...jeSpieltag.entries()]
    .map(([matchdayId, wert]) => {
      const i = ids.indexOf(matchdayId);
      return { matchdayId, spieltag: i >= 0 ? i + 1 : null, wert };
    })
    .sort((a, b) => (a.spieltag ?? 1e9) - (b.spieltag ?? 1e9));
}
