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
  /**
   * DER TANK — alle Karten dieser Saison, gespielt wie ungespielt.
   *
   * Chris: „in der formkarten spalte soll generell immer die summe stehen die AM ANFANG der
   * saison den teams zur verfuegung stand ... dann weiss man wie viel luft noch im tank ist".
   *
   * Warum das noetig war, zeigt die Messung am Live-Save: die Karten kommen je Spieler als
   * gespiegeltes Paar (+x und −x), jedes Team hat also `poolPositive === -poolNegative`, und
   * die negativen werden zuerst abgeworfen (ungespielte negative Karten kosten am Saisonende
   * Punkte, siehe `applyFormCardPenaltyWithRerank`). Die Summe der GESPIELTEN Nennwerte ist
   * damit fast bauartbedingt ≤ 0 — gemessen bei allen 32 Teams. Als „wie stark war die Form
   * dieses Teams" taugt sie nicht; sie sagt nur, wie viel Negatives schon abgeraeumt ist.
   *
   * ABGRENZUNG „am Saisonanfang": es gibt keinen historischen Anfangsbestand im Spielstand.
   * Gezaehlt wird der HEUTIGE Kartensatz der Saison. Er entspricht dem Anfangsbestand, solange
   * kein Transfer ungespielte Karten mitgenommen hat (`ensureLocalFormCardsForSeason` raeumt
   * die Karten verkaufter Spieler ab, gespielte bleiben liegen). Ein geraten rekonstruierter
   * Anfangsbestand waere schlechter als diese ehrliche Zahl.
   */
  poolCards: number;
  /** Summe aller positiven Nennwerte der Saison — der volle Tank. */
  poolPositive: number;
  /** Summe aller negativen Nennwerte der Saison (≤ 0) — die Hypothek. */
  poolNegative: number;
  /** Noch nicht gespielte positive Nennwerte — „wie viel Luft ist noch im Tank". */
  remainingPositive: number;
  /** Noch nicht gespielte negative Nennwerte (≤ 0) — was am Saisonende noch Punkte kostet. */
  remainingNegative: number;
  /** Anzahl noch nicht gespielter Karten. */
  remainingCards: number;
};

export type SeasonFormCardBonusByTeamId = Map<string, SeasonFormCardBonusEntry>;

function createEmptyEntry(): SeasonFormCardBonusEntry {
  return {
    total: 0,
    cards: 0,
    positive: 0,
    negative: 0,
    poolCards: 0,
    poolPositive: 0,
    poolNegative: 0,
    remainingPositive: 0,
    remainingNegative: 0,
    remainingCards: 0,
  };
}

export function buildSeasonFormCardBonusByTeamId(
  gameState: Pick<GameState, "seasonState">,
  seasonId: string,
): SeasonFormCardBonusByTeamId {
  /**
   * Vorfahrt fuer die mitgelieferte Bilanz (`foundation-form-card-projection`). Im Browser
   * sind die `lineupDrafts` auf den aktiven Spieltag beschnitten — eine Neuberechnung fande
   * hier bestenfalls die Karten EINES Spieltags und die Saisonstand-Spalte zeigte Striche.
   * Die Projektion ist auf dem vollen Save gerechnet und deckt genau die laufende Saison ab;
   * fuer jede andere `seasonId` (Archiv) faellt die Rechnung unveraendert unten durch.
   */
  const projektion = gameState.seasonState.foundationFormCardBonus;
  if (projektion && projektion.seasonId === seasonId) {
    return new Map(Object.entries(projektion.byTeamId));
  }

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
  for (const card of formCards) {
    if (card.seasonId !== seasonId) {
      continue;
    }
    const value = card.cardValue;
    if (value == null || !Number.isFinite(value) || value === 0) {
      continue;
    }
    const entry = result.get(card.teamId) ?? createEmptyEntry();

    // Der Tank zaehlt JEDE Karte der Saison — auch die noch ungespielten. Nur so beantwortet
    // die Spalte die Frage „wie viel Luft ist noch drin" statt „wie viel Negatives ist schon weg".
    entry.poolCards += 1;
    if (value > 0) {
      entry.poolPositive += value;
    } else {
      entry.poolNegative += value;
    }

    if (!usedCardIds.has(card.id)) {
      entry.remainingCards += 1;
      if (value > 0) {
        entry.remainingPositive += value;
      } else {
        entry.remainingNegative += value;
      }
      result.set(card.teamId, entry);
      continue;
    }

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
