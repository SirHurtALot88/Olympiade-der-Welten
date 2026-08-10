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

  /**
   * GEMELDET: „buyout soll nicht zu 100% weg fallen sondern nur anteilig je nachdem was der
   * spieler noch für forderungen stellt. sonst wäre das ja OP."
   *
   * Vorher entfiel der volle Rest-Buyout und das Team kassierte den ungekuerzten Preis —
   * Annehmen war damit IMMER besser als ein regulaerer Verkauf, also gar keine Entscheidung.
   */
  it("erlaesst den Buyout nur anteilig und weist den zahlbaren Rest aus", () => {
    const offer = offersFor()[0];
    // Preis kommt aus derselben Rechnung wie der regulaere Verkauf.
    expect(offer.salePrice).toBe(40);
    // Restlaufzeit 3 -> nach dieser Saison bleiben 2 Jahre a 5.
    expect(offer.openBuyout).toBe(10);
    expect(offer.remainingContractLength).toBe(3);
    // Moral 20 von 34: Grundverzicht 30 % + 30 % x (1 - 20/34) = 42,35 %.
    expect(offer.waiverShare).toBeCloseTo(0.4235, 3);
    expect(offer.waivedBuyout).toBeCloseTo(4.24, 2);
    expect(offer.payableBuyout).toBeCloseTo(5.76, 2);
    // Die Teile ergeben wieder das Ganze — sonst verschwindet Geld zwischen den Zahlen.
    expect(offer.waivedBuyout + offer.payableBuyout).toBeCloseTo(offer.openBuyout, 2);
  });

  it("laesst einen unglueklicheren Spieler mehr aufgeben", () => {
    const wenigerUngluecklich = offersFor(gameState(), { "p-star": 30 })[0];
    const sehrUngluecklich = offersFor(gameState(), { "p-star": 5 })[0];
    expect(sehrUngluecklich.waiverShare).toBeGreaterThan(wenigerUngluecklich.waiverShare);
  });

  it("bleibt schlechter als geschenkt und besser als ein regulaerer Verkauf", () => {
    // Genau die Spanne, in der die Annahme eine Abwaegung ist statt eines Selbstlaeufers.
    const offer = offersFor()[0];
    const regulaer = offer.salePrice - offer.openBuyout;
    const netto = offer.salePrice - offer.payableBuyout;
    expect(netto).toBeGreaterThan(regulaer);
    expect(netto).toBeLessThan(offer.salePrice);
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
  it("laesst den Spieler gehen und bucht Preis minus zahlbarem Buyout", () => {
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

    // 100 + 40 - 5,76 zahlbarer Buyout. Vorher standen hier 140 — der Buyout fiel unter den Tisch.
    expect(after.teams.find((team) => team.teamId === "C-C")?.cash).toBeCloseTo(134.24, 2);
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

  /**
   * GEMELDET: „bekommt dann noch mal einen großen Moral Malus von -20 oder so — damit seine
   * leistung auch spürbar schlechter wird und man es nicht nutzt um zu wissen ja der spieler
   * will eh raus dann kann ich ihn nächste saison abgeben".
   */
  it("kostet spuerbar Moral — eine Ablehnung ist teuer, nicht nur unangenehm", () => {
    expect(applyDeclinePenalty(30)).toBe(10);
    // Nie unter null, sonst kippt die Moral-Skala.
    expect(applyDeclinePenalty(3)).toBe(0);
  });

  it("senkt die GESPEICHERTE Moral des Spielers", () => {
    // Der Abzug muss auf `playerMoraleState` landen — daraus leitet assessPlayerMorale den
    // angezeigten Wert und den contractIntent ab. Nur ein Log-Eintrag waere folgenlos.
    const before = gameState({
      playerMoraleState: [
        { playerId: "p-star", teamId: "C-C", morale: 20 },
        { playerId: "p-happy", teamId: "C-C", morale: 70 },
      ],
    });
    const after = declineContractDissolution({
      gameState: before,
      offer: offersFor(before)[0],
      seasonId: "season-1",
      saveId: "save-1",
      decidedAt: "2027-01-01T00:00:00.000Z",
    }) as unknown as { playerMoraleState: Array<{ playerId: string; morale: number }> };

    expect(after.playerMoraleState.find((entry) => entry.playerId === "p-star")?.morale).toBe(0);
    // Mitspieler bleiben unberuehrt.
    expect(after.playerMoraleState.find((entry) => entry.playerId === "p-happy")?.morale).toBe(70);
  });

  it("erfindet keine Moral-Zeile, wenn der Spieler noch keine hat", () => {
    const after = declineContractDissolution({
      gameState: gameState(),
      offer: offersFor()[0],
      seasonId: "season-1",
      saveId: "save-1",
      decidedAt: "2027-01-01T00:00:00.000Z",
    }) as unknown as { playerMoraleState?: unknown[] };

    expect(after.playerMoraleState).toEqual([]);
  });
});
