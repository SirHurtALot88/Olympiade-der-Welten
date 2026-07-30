import { describe, expect, it, vi } from "vitest";

// Preisrechnung des regulaeren Verkaufs stubben: hier wird die ENTSCHEIDUNGS-Logik
// geprueft, nicht der Sale-Faktor (der hat eigene Tests). Wichtig ist nur, dass der
// Dienst dieselbe Quelle benutzt statt eine zweite Rechnung aufzumachen.
vi.mock("@/lib/market/transfermarkt-sale-factor", () => ({
  buildTransfermarktSaleFactorBreakdown: (_gs: unknown, player: { id: string }) => ({
    salePrice: player.id === "p-star" ? 40 : 12,
  }),
  normalizeVisibleRosterMoney: (value: number | null) => value,
}));
vi.mock("@/lib/foundation/player-economy-contract", () => ({
  resolvePlayerEconomyContract: () => ({ marketValue: 10, purchasePrice: 10 }),
}));

const {
  DISSOLUTION_MORALE_THRESHOLD,
  acceptContractDissolution,
  applyDeclinePenalty,
  buildContractDissolutionOffers,
  declineContractDissolution,
} = await import("@/lib/morale/contract-dissolution-service");

function gameState(overrides: Record<string, unknown> = {}) {
  return {
    players: [
      { id: "p-star", name: "Bumblecrank" },
      { id: "p-happy", name: "Zufrieden" },
      { id: "p-other", name: "Fremdes Team" },
    ],
    rosters: [
      { teamId: "C-C", playerId: "p-star", contractLength: 3, salary: 5 },
      { teamId: "C-C", playerId: "p-happy", contractLength: 2, salary: 4 },
      { teamId: "M-M", playerId: "p-other", contractLength: 1, salary: 3 },
    ],
    teams: [
      { teamId: "C-C", cash: 100 },
      { teamId: "M-M", cash: 50 },
    ],
    seasonState: {},
    ...overrides,
  } as never;
}

const scope = { seasonId: "season-1", saveId: "save-1", teamId: "C-C" };

function offersFor(state = gameState(), morale: Record<string, number> = { "p-star": 20, "p-happy": 70 }) {
  return buildContractDissolutionOffers({ gameState: state, ...scope, moraleByPlayerId: morale });
}

describe("Wer bietet eine Vertragsaufloesung an", () => {
  it("nur unzufriedene Spieler des eigenen Teams", () => {
    const offers = offersFor();
    expect(offers.map((offer) => offer.playerId)).toEqual(["p-star"]);
    expect(offers[0].playerName).toBe("Bumblecrank");
    expect(offers[0].morale).toBe(20);
  });

  it("nicht bei zufriedenen Spielern — die Schwelle ist die Moral-Grenze", () => {
    expect(offersFor(gameState(), { "p-star": DISSOLUTION_MORALE_THRESHOLD })).toEqual([]);
    expect(offersFor(gameState(), { "p-star": DISSOLUTION_MORALE_THRESHOLD - 0.1 })).toHaveLength(1);
  });

  it("weist den vollen Verkaufspreis und den entfallenden Buyout aus", () => {
    const offer = offersFor()[0];
    // Preis kommt aus derselben Rechnung wie der regulaere Verkauf.
    expect(offer.salePrice).toBe(40);
    // Restlaufzeit 3 -> nach dieser Saison bleiben 2 Jahre a 5.
    expect(offer.waivedBuyout).toBe(10);
    expect(offer.remainingContractLength).toBe(3);
  });

  it("fragt in derselben Saison nicht zweimal", () => {
    const decided = gameState({
      seasonState: {
        contractDissolutions: [
          { saveId: "save-1", seasonId: "season-1", teamId: "C-C", playerId: "p-star", decision: "declined" },
        ],
      },
    });
    expect(offersFor(decided)).toEqual([]);
  });

  it("darf naechste Saison erneut fragen und merkt sich die fruehere Ablehnung", () => {
    const lastSeason = gameState({
      seasonState: {
        contractDissolutions: [
          { saveId: "save-1", seasonId: "season-0", teamId: "C-C", playerId: "p-star", decision: "declined" },
        ],
      },
    });
    const offers = offersFor(lastSeason);
    expect(offers).toHaveLength(1);
    expect(offers[0].previouslyDeclined).toBe(true);
  });
});

describe("Annahme", () => {
  it("laesst den Spieler gehen und schreibt den vollen Preis gut", () => {
    const before = gameState();
    const offer = offersFor(before)[0];
    const after = acceptContractDissolution({
      gameState: before,
      offer,
      seasonId: "season-1",
      saveId: "save-1",
      decidedAt: "2027-01-01T00:00:00.000Z",
    }) as unknown as {
      teams: Array<{ teamId: string; cash: number }>;
      rosters: Array<{ teamId: string; playerId: string }>;
      seasonState: { contractDissolutions: Array<{ decision: string; salePrice: number }> };
    };

    expect(after.teams.find((team) => team.teamId === "C-C")?.cash).toBe(140);
    expect(after.rosters.some((entry) => entry.playerId === "p-star")).toBe(false);
    // Fremde Teams und der Rest des Kaders bleiben unangetastet.
    expect(after.teams.find((team) => team.teamId === "M-M")?.cash).toBe(50);
    expect(after.rosters).toHaveLength(2);
    expect(after.seasonState.contractDissolutions[0]).toMatchObject({ decision: "accepted", salePrice: 40 });
  });
});

describe("Ablehnung", () => {
  it("laesst den Spieler im Kader und haelt die Entscheidung fest", () => {
    const before = gameState();
    const offer = offersFor(before)[0];
    const after = declineContractDissolution({
      gameState: before,
      offer,
      seasonId: "season-1",
      saveId: "save-1",
      decidedAt: "2027-01-01T00:00:00.000Z",
    }) as unknown as {
      rosters: Array<{ playerId: string }>;
      teams: Array<{ teamId: string; cash: number }>;
      seasonState: { contractDissolutions: Array<{ decision: string }> };
    };

    expect(after.rosters.some((entry) => entry.playerId === "p-star")).toBe(true);
    // Kein Geld fliesst — der Spieler erfuellt seinen Vertrag.
    expect(after.teams.find((team) => team.teamId === "C-C")?.cash).toBe(100);
    expect(after.seasonState.contractDissolutions[0].decision).toBe("declined");
  });

  it("kostet Moral — eine Ablehnung ist nicht folgenlos", () => {
    expect(applyDeclinePenalty(20)).toBe(14);
    // Nie unter null, sonst kippt die Moral-Skala.
    expect(applyDeclinePenalty(3)).toBe(0);
  });
});
