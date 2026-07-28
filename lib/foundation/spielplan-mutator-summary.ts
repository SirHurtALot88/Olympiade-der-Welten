import type { GameState } from "@/lib/data/olyDataTypes";
import {
  getPlayerMutatorTraitSlots,
  rollMatchdayMutatorTraitsForSide,
} from "@/lib/lineups/legacy-lineup-modifiers";

/**
 * Spielplan-Ansicht: welche zwei Mutatoren je Spieltag(-Seite) gewürfelt wurden,
 * wie viele TREFFER es beim aufgelösten Spieltag gab und WELCHE Spieler getroffen
 * haben (fürs Hover-Panel der Mutator-Spalten).
 *
 * Datenquellen — bewusst NICHTS erfunden:
 * - Trait-Labels: `rollMatchdayMutatorTraitsForSide` — derselbe deterministische
 *   Seed (saveId/seasonId/matchdayId/Seite/disciplineId), den auch die
 *   Resolve-Engine über `buildMatchdayMutatorTraitsBySide` nutzt. Die Labels
 *   stehen damit auch für zukünftige Spieltage fest (kein Zufall zur Laufzeit).
 * - Treffer: die GESPEICHERTEN `playerDisciplinePerformances` der applied
 *   Matchday-Results (`mutatorScoreBonus`, +6 je Treffer laut
 *   `calculateMutatorModifierForSide`) — also das, was wirklich gewertet wurde,
 *   keine Nachrechnung, die bei Engine-Änderungen driften könnte. Gezählt sind
 *   dadurch automatisch nur AUFGESTELLTE Spieler (die Engine iteriert nur über
 *   `input.entries`; Bankspieler bekommen nie einen Bonus) — das ist korrekt so.
 * - Zuordnung Treffer → Mutator-Spalte: über die Trait-Slots des Spielers
 *   (`getPlayerMutatorTraitSlots`, dieselbe Normalisierung wie die Engine).
 *   Hat ein Team per gespeicherter Auswahl ANDERE Traits gewertet (Vorrang
 *   `mutatorTrait1/2` im Lineup-Draft), passt der Bonus zu keinem der beiden
 *   Spieltag-Traits — solche Treffer landen ehrlich in `unattributedHitCount`
 *   statt in einer der beiden Spalten.
 */

export type SpielplanMutatorHitPlayer = {
  playerId: string;
  playerName: string;
  teamCode: string | null;
};

export type SpielplanMutatorSlotSummary = {
  /** Gewürfelter Spieltag-Trait (Label wie in der Engine, z. B. "Mutant"). */
  label: string;
  /** Treffer über alle Teams des Spieltags (nur aufgestellte Spieler). */
  hitCount: number;
  hitPlayers: SpielplanMutatorHitPlayer[];
};

export type SpielplanDisciplineMutatorSummary = {
  disciplineId: string;
  matchdayId: string;
  disciplineSide: "d1" | "d2";
  /** true = mindestens ein applied Matchday-Result → Treffer sind echte Vergangenheit. */
  resolved: boolean;
  slots: [SpielplanMutatorSlotSummary, SpielplanMutatorSlotSummary];
  /** Treffer mit gespeichertem Bonus, die keinem der beiden Spieltag-Traits zuordenbar sind. */
  unattributedHitCount: number;
};

function normalizeTraitKey(trait: string): string {
  // Gleiche Normalisierung wie `normalizeTraitKey` in legacy-lineup-modifiers.ts
  // (dort nicht exportiert): trim + lowercase — Treffer-Zuordnung muss exakt der
  // Engine-Zählung entsprechen.
  return trait.trim().toLowerCase();
}

export function buildSpielplanMutatorSummaries(input: {
  gameState: GameState;
  saveId: string;
  scheduleRows: Array<{
    matchdayId: string;
    discipline1?: { disciplineId?: string | null } | null;
    discipline2?: { disciplineId?: string | null } | null;
  }>;
}): Map<string, SpielplanDisciplineMutatorSummary> {
  const { gameState, saveId } = input;
  const summaries = new Map<string, SpielplanDisciplineMutatorSummary>();
  const playersById = new Map(gameState.players.map((player) => [player.id, player] as const));
  const teamCodeById = new Map(gameState.teams.map((team) => [team.teamId, team.shortCode] as const));

  // Applied Results der AKTUELLEN Saison → matchdayId je Result-ID. Nur diese
  // zählen als "gewertet" — superseded/voided Ergebnisse würden Treffer doppeln.
  const matchdayIdByResultId = new Map<string, string>();
  for (const result of gameState.seasonState.matchdayResults ?? []) {
    if (result.seasonId === gameState.season.id && result.status === "preview_applied") {
      matchdayIdByResultId.set(result.id, result.matchdayId);
    }
  }

  // Performance-Zeilen mit Mutator-Bonus, gruppiert nach (matchdayId, disciplineId).
  const hitRowsByKey = new Map<string, Array<{ playerId: string; teamId: string; hits: number }>>();
  for (const performance of gameState.seasonState.playerDisciplinePerformances ?? []) {
    const matchdayId = matchdayIdByResultId.get(performance.matchdayResultId);
    if (!matchdayId) {
      continue;
    }
    const bonus = performance.mutatorScoreBonus ?? 0;
    if (!(bonus > 0)) {
      continue;
    }
    const key = `${matchdayId}::${performance.disciplineId}`;
    const bucket = hitRowsByKey.get(key) ?? [];
    bucket.push({
      playerId: performance.playerId,
      teamId: performance.teamId,
      // +6 Score je Treffer (calculateMutatorModifierForSide) → Bonus/6 = Trefferzahl.
      hits: Math.max(1, Math.round(bonus / 6)),
    });
    hitRowsByKey.set(key, bucket);
  }

  const resolvedMatchdayIds = new Set(matchdayIdByResultId.values());

  for (const row of input.scheduleRows) {
    const sides: Array<{ side: "d1" | "d2"; disciplineId: string | null }> = [
      { side: "d1", disciplineId: row.discipline1?.disciplineId ?? null },
      { side: "d2", disciplineId: row.discipline2?.disciplineId ?? null },
    ];

    for (const { side, disciplineId } of sides) {
      if (!disciplineId) {
        continue;
      }

      const [trait1, trait2] = rollMatchdayMutatorTraitsForSide({
        saveId,
        seasonId: gameState.season.id,
        matchdayId: row.matchdayId,
        disciplineSide: side,
        disciplineId,
      });

      const slots: [SpielplanMutatorSlotSummary, SpielplanMutatorSlotSummary] = [
        { label: trait1, hitCount: 0, hitPlayers: [] },
        { label: trait2, hitCount: 0, hitPlayers: [] },
      ];
      let unattributedHitCount = 0;

      for (const hitRow of hitRowsByKey.get(`${row.matchdayId}::${disciplineId}`) ?? []) {
        const player = playersById.get(hitRow.playerId) ?? null;
        // Trait-Slots dedupliziert wie in der Engine (`countTraitHits`): ein Trait
        // zählt pro Spieler höchstens einmal, egal wie oft er in den Slots steht.
        const playerTraitKeys = new Set(
          getPlayerMutatorTraitSlots(player).map(normalizeTraitKey).filter(Boolean),
        );
        const hitPlayer: SpielplanMutatorHitPlayer = {
          playerId: hitRow.playerId,
          playerName: player?.name ?? hitRow.playerId,
          teamCode: teamCodeById.get(hitRow.teamId) ?? null,
        };
        let attributed = 0;
        slots.forEach((slot) => {
          if (slot.label && playerTraitKeys.has(normalizeTraitKey(slot.label))) {
            slot.hitCount += 1;
            slot.hitPlayers.push(hitPlayer);
            attributed += 1;
          }
        });
        if (attributed < hitRow.hits) {
          unattributedHitCount += hitRow.hits - attributed;
        }
      }

      summaries.set(disciplineId, {
        disciplineId,
        matchdayId: row.matchdayId,
        disciplineSide: side,
        resolved: resolvedMatchdayIds.has(row.matchdayId),
        slots,
        unattributedHitCount,
      });
    }
  }

  return summaries;
}
