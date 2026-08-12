import { describe, expect, it } from "vitest";

import { buildSeasonFormCardBonusByTeamId } from "@/lib/foundation/season-form-card-bonus";

type CardInput = { id: string; seasonId: string; teamId: string; cardValue: number };
type DraftInput = {
  seasonId: string;
  modifiers?: {
    d1?: { primaryFormCardId?: string | null; secondaryFormCardId?: string | null };
    d2?: { primaryFormCardId?: string | null; secondaryFormCardId?: string | null };
  };
};

function makeGameState(input: { formCards: CardInput[]; lineupDrafts: DraftInput[] }) {
  return {
    seasonState: {
      formCards: input.formCards,
      lineupDrafts: input.lineupDrafts,
    },
  } as unknown as Parameters<typeof buildSeasonFormCardBonusByTeamId>[0];
}

describe("buildSeasonFormCardBonusByTeamId", () => {
  it("sums the face value of played cards (+8 counts 8, -4 counts -4)", () => {
    const gameState = makeGameState({
      formCards: [
        { id: "c1", seasonId: "S1", teamId: "A-A", cardValue: 8 },
        { id: "c2", seasonId: "S1", teamId: "A-A", cardValue: -4 },
        { id: "c3", seasonId: "S1", teamId: "A-A", cardValue: 6 },
        { id: "c4", seasonId: "S1", teamId: "B-B", cardValue: 5 },
      ],
      lineupDrafts: [
        { seasonId: "S1", modifiers: { d1: { primaryFormCardId: "c1", secondaryFormCardId: "c2" } } },
        { seasonId: "S1", modifiers: { d2: { primaryFormCardId: "c4" } } },
      ],
    });

    const byTeam = buildSeasonFormCardBonusByTeamId(gameState, "S1");

    // c3 lag nur auf der Hand → zählt bei den GESPIELTEN nicht mit ...
    expect(byTeam.get("A-A")).toMatchObject({ total: 4, cards: 2, positive: 8, negative: -4 });
    expect(byTeam.get("B-B")).toMatchObject({ total: 5, cards: 1, positive: 5, negative: 0 });
    // ... im Tank aber sehr wohl: er ist die Frage "wie viel war ueberhaupt da".
    expect(byTeam.get("A-A")).toMatchObject({
      poolCards: 3,
      poolPositive: 14,
      poolNegative: -4,
      remainingCards: 1,
      remainingPositive: 6,
      remainingNegative: 0,
    });
  });

  it("ignores drafts and cards of other seasons", () => {
    const gameState = makeGameState({
      formCards: [
        { id: "c1", seasonId: "S1", teamId: "A-A", cardValue: 8 },
        { id: "c2", seasonId: "S2", teamId: "A-A", cardValue: 9 },
      ],
      lineupDrafts: [
        { seasonId: "S2", modifiers: { d1: { primaryFormCardId: "c1" } } },
        { seasonId: "S2", modifiers: { d1: { primaryFormCardId: "c2" } } },
      ],
    });

    const byTeam = buildSeasonFormCardBonusByTeamId(gameState, "S1");
    // Die S1-Karte gehoert in den S1-Tank (sie ist da, nur ungespielt) — die S2-Karte nicht,
    // und der S2-Entwurf darf die S1-Karte nicht als gespielt markieren.
    expect(byTeam.get("A-A")).toEqual({
      total: 0,
      cards: 0,
      positive: 0,
      negative: 0,
      poolCards: 1,
      poolPositive: 8,
      poolNegative: 0,
      remainingCards: 1,
      remainingPositive: 8,
      remainingNegative: 0,
    });
  });

  it("fuehrt den vollen Tank auch dann, wenn noch keine Karte gespielt wurde", () => {
    // Frueher gab es hier eine leere Karte. Fuer die Spalte "wie viel Luft ist noch im Tank"
    // ist das aber der interessanteste Fall ueberhaupt: alles noch da, nichts ausgegeben.
    const gameState = makeGameState({
      formCards: [
        { id: "c1", seasonId: "S1", teamId: "A-A", cardValue: 8 },
        { id: "c2", seasonId: "S1", teamId: "A-A", cardValue: -8 },
      ],
      lineupDrafts: [{ seasonId: "S1", modifiers: { d1: {} } }],
    });

    expect(buildSeasonFormCardBonusByTeamId(gameState, "S1").get("A-A")).toEqual({
      total: 0,
      cards: 0,
      positive: 0,
      negative: 0,
      poolCards: 2,
      poolPositive: 8,
      poolNegative: -8,
      remainingCards: 2,
      remainingPositive: 8,
      remainingNegative: -8,
    });
  });

  it("skips zero-value cards (the empty slot of a player's card pair)", () => {
    const gameState = makeGameState({
      formCards: [
        { id: "c1", seasonId: "S1", teamId: "A-A", cardValue: 0 },
        { id: "c2", seasonId: "S1", teamId: "A-A", cardValue: 7 },
      ],
      lineupDrafts: [
        { seasonId: "S1", modifiers: { d1: { primaryFormCardId: "c1", secondaryFormCardId: "c2" } } },
      ],
    });

    expect(buildSeasonFormCardBonusByTeamId(gameState, "S1").get("A-A")).toMatchObject({
      total: 7,
      cards: 1,
      positive: 7,
      negative: 0,
      // Die 0-Karte zaehlt auch im Tank nicht mit.
      poolCards: 1,
      poolPositive: 7,
    });
  });

  it("eine mitgeschickte Fremd-Bilanz ueberstimmt die Aufstellungen NICHT mehr", () => {
    /**
     * FRUEHER HIESS DIESER FALL „prefers the shipped balance over beschnittene Aufstellungen".
     * Damals beschnitt die Anfangsladung die `lineupDrafts` auf den aktiven Spieltag, und die
     * mitgelieferte Projektion `foundationFormCardBonus` hatte hier BEDINGUNGSLOS Vorfahrt.
     *
     * Beides ist weg: die `lineupDrafts` fahren seit `8ec6454b` vollstaendig mit, die Projektion
     * ist entfernt. Was hier geprueft wird, ist die Gegenprobe — ein alter Browser-Tab, der das
     * Feld noch mitschickt, darf die Spalte nicht mehr auf seinen Ladezeitpunkt einfrieren.
     * Gezaehlt wird, was in den Aufstellungen steht: eine Karte, Nennwert 8.
     */
    const gameState = makeGameState({
      formCards: [{ id: "c1", seasonId: "S1", teamId: "A-A", cardValue: 8 }],
      lineupDrafts: [{ seasonId: "S1", modifiers: { d1: { primaryFormCardId: "c1" } } }],
    });
    (gameState.seasonState as { foundationFormCardBonus?: unknown }).foundationFormCardBonus = {
      seasonId: "S1",
      byTeamId: { "A-A": { total: -8, cards: 15, positive: 34, negative: -42 } },
    };

    expect(buildSeasonFormCardBonusByTeamId(gameState, "S1").get("A-A")).toMatchObject({
      total: 8,
      cards: 1,
      positive: 8,
      negative: 0,
    });
  });

  it("trennt den Tank von dem, was schon ausgegeben ist", () => {
    // Chris: "dann weiss man wie viel luft noch im tank ist". Genau die zwei Zahlen der
    // beiden Saisonstand-Spalten — voller Tank und Rest — an einem Fall, in dem sie
    // auseinanderlaufen: eine von drei Pluskarten ist gelegt, die Minuskarte noch offen.
    const gameState = makeGameState({
      formCards: [
        { id: "p1", seasonId: "S1", teamId: "A-A", cardValue: 6 },
        { id: "p2", seasonId: "S1", teamId: "A-A", cardValue: 4 },
        { id: "p3", seasonId: "S1", teamId: "A-A", cardValue: 2 },
        { id: "m1", seasonId: "S1", teamId: "A-A", cardValue: -5 },
      ],
      lineupDrafts: [{ seasonId: "S1", modifiers: { d1: { primaryFormCardId: "p1" } } }],
    });

    expect(buildSeasonFormCardBonusByTeamId(gameState, "S1").get("A-A")).toEqual({
      total: 6,
      cards: 1,
      positive: 6,
      negative: 0,
      poolCards: 4,
      poolPositive: 12,
      poolNegative: -5,
      remainingCards: 3,
      remainingPositive: 6,
      remainingNegative: -5,
    });
  });
});
