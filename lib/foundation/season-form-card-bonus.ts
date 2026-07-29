import type { GameState } from "@/lib/data/olyDataTypes";

/**
 * Formkarten-Bilanz einer Saison je Team — die SUMME der tatsächlich gespielten
 * Kartenwerte, ohne jede Umrechnung: eine +8-Karte zählt 8, eine −4-Karte zählt −4.
 *
 * ABGRENZUNG (wichtig, sonst stehen im Saisonstand zwei "Form"-Zahlen, die nichts
 * miteinander zu tun haben):
 * - `buildPpAreaFormBonusByTeamId` summiert `disciplineResult.formModifier`, also den
 *   auf die Disziplin ANGEWANDTEN Effekt (Kartenwert × Spielerzahl, inkl. ×2 bei
 *   Farbgleichheit). Das ist die Wirkung im Ergebnis.
 * - Diese Datei summiert den NENNWERT der Karten, die das Team im Saisonverlauf
 *   ausgespielt hat. Das ist die Frage "wie viel Formkarten-Bonus hatte das Team
 *   überhaupt auf der Hand und aufs Feld gebracht" — unabhängig davon, in welcher
 *   Disziplin die Karte gelandet ist und wie viele Spieler dort standen.
 *
 * Quelle für "gespielt": die Modifier-Slots der Aufstellungen (`lineupDrafts`) —
 * dieselbe Zuordnung, aus der auch `getTeamFormCardOptions` das `isUsed`-Flag der
 * Kartenauswahl ableitet. Karten, die nur auf der Hand lagen, zählen NICHT mit.
 */

export type SeasonFormCardBonusEntry = {
  /** Summe der Nennwerte aller gespielten Karten (positiv + negativ). */
  total: number;
  /** Anzahl gespielter Karten. */
  cards: number;
  /** Summe nur der positiven Nennwerte. */
  positive: number;
  /** Summe nur der negativen Nennwerte (≤ 0). */
  negative: number;
};

export type SeasonFormCardBonusByTeamId = Map<string, SeasonFormCardBonusEntry>;

function createEmptyEntry(): SeasonFormCardBonusEntry {
  return { total: 0, cards: 0, positive: 0, negative: 0 };
}

export function buildSeasonFormCardBonusByTeamId(
  gameState: Pick<GameState, "seasonState">,
  seasonId: string,
): SeasonFormCardBonusByTeamId {
  const result: SeasonFormCardBonusByTeamId = new Map();
  const formCards = gameState.seasonState.formCards ?? [];
  if (formCards.length === 0) {
    return result;
  }

  // Alle in dieser Saison AUSGESPIELTEN Karten-IDs (beide Disziplin-Seiten, je
  // Primär-/Sekundärslot) — identische Ableitung wie `buildFormCardUsageMap`.
  const usedCardIds = new Set<string>();
  for (const draft of gameState.seasonState.lineupDrafts ?? []) {
    if (draft.seasonId !== seasonId) {
      continue;
    }
    const modifiers = draft.modifiers;
    for (const cardId of [
      modifiers?.d1?.primaryFormCardId,
      modifiers?.d1?.secondaryFormCardId,
      modifiers?.d2?.primaryFormCardId,
      modifiers?.d2?.secondaryFormCardId,
    ]) {
      if (cardId) {
        usedCardIds.add(cardId);
      }
    }
  }
  if (usedCardIds.size === 0) {
    return result;
  }

  for (const card of formCards) {
    if (card.seasonId !== seasonId || !usedCardIds.has(card.id)) {
      continue;
    }
    const value = card.cardValue;
    if (value == null || !Number.isFinite(value) || value === 0) {
      continue;
    }
    const entry = result.get(card.teamId) ?? createEmptyEntry();
    entry.total += value;
    entry.cards += 1;
    if (value > 0) {
      entry.positive += value;
    } else {
      entry.negative += value;
    }
    result.set(card.teamId, entry);
  }

  return result;
}
