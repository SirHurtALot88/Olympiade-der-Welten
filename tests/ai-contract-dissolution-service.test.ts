import { describe, expect, it, vi } from "vitest";

/**
 * Die Moral wird fuer den Liga-Lauf festgelegt statt aus dem Fixture abgeleitet: `assessPlayerMorale`
 * rechnet sie aus Leistung, Einsatzzeit, Gehalt und Tabellenlage neu: ein Fixture, das damit unter
 * die Schwelle kommt, waere ein halber Spielstand und wuerde bei jeder Moral-Aenderung kippen.
 * Geprueft wird hier die ENTSCHEIDUNG, nicht die Moralrechnung — die hat eigene Tests.
 */
const MORAL_JE_SPIELER: Record<string, number> = { "p-ki": 20, "p-mensch": 20, "p-froh": 80 };
vi.mock("@/lib/morale/player-morale-service", async () => {
  const echt = await vi.importActual<typeof import("@/lib/morale/player-morale-service")>(
    "@/lib/morale/player-morale-service",
  );
  return {
    ...echt,
    assessPlayerMorale: (input: { playerId: string }) => ({ morale: MORAL_JE_SPIELER[input.playerId] ?? 60 }),
  };
});

import {
  AI_DISSOLUTION_MORALE_FLOOR,
  applyAiContractDissolutions,
  decideAiContractDissolution,
  resolveQualityShareInTeam,
  type AiDissolutionRenewalSignal,
} from "@/lib/morale/ai-contract-dissolution-service";
import {
  CONTRACT_DISSOLUTION_TRANSFER_SOURCE,
  type ContractDissolutionOffer,
} from "@/lib/morale/contract-dissolution-service";

/**
 * Alle Tests hier pruefen WERTE, keine Quelltext-Strings: welche Lage fuehrt zu welcher
 * Entscheidung, welche Zahl steht danach in der Kasse, welche Buchung entsteht.
 */

function offer(overrides: Partial<ContractDissolutionOffer> = {}): ContractDissolutionOffer {
  return {
    playerId: "p1",
    playerName: "Testspieler",
    teamId: "C-C",
    morale: 30,
    salePrice: 20,
    openBuyout: 0,
    waivedBuyout: 0,
    payableBuyout: 0,
    waiverShare: 0.3,
    remainingContractLength: 1,
    previouslyDeclined: false,
    ...overrides,
  };
}

function lage(overrides: Partial<Parameters<typeof decideAiContractDissolution>[0]> = {}) {
  return {
    offer: offer(),
    marketValue: 20,
    salary: 5,
    remainingYears: 2,
    purchasePrice: null,
    qualityShareInTeam: 0.5,
    ratingValue: 40,
    rosterBefore: 11,
    playerMin: 8,
    playerOpt: 11,
    cashBefore: 50,
    renewal: null as AiDissolutionRenewalSignal | null,
    ...overrides,
  };
}

describe("Die Abwaegung der KI", () => {
  it("nimmt an, wenn Erloes plus gespartes Gehalt den Restwert schlagen", () => {
    // Erloes 20 + 2 Jahre a 5 = 30 gegen einen Restwert von rund 20 x 0,79 x 1,0 x 1,04.
    const entscheidung = decideAiContractDissolution(lage());
    expect(entscheidung.exitGain).toBe(30);
    expect(entscheidung.keepWorth).toBeLessThan(entscheidung.exitGain);
    expect(entscheidung.decision).toBe("accepted");
    expect(entscheidung.reason).toBe("exit_gain_higher");
  });

  it("lehnt ab, wenn derselbe Spieler bei kleinerem Erloes teurer zu ersetzen waere", () => {
    // Gleicher Spieler, nur ein magerer Verkaufserloes und kein Restgehalt zu sparen.
    const entscheidung = decideAiContractDissolution(
      lage({ offer: offer({ salePrice: 4 }), remainingYears: 1, salary: 1 }),
    );
    expect(entscheidung.exitGain).toBe(5);
    expect(entscheidung.keepWorth).toBeGreaterThan(entscheidung.exitGain);
    expect(entscheidung.decision).toBe("declined");
    expect(entscheidung.reason).toBe("keep_worth_higher");
  });

  /**
   * DIE GRENZE MUSS SICH BEWEGEN. Eine Entscheidung, die bei jedem Preis gleich ausfaellt, ist
   * keine Abwaegung. Der Test faehrt den Verkaufserloes hoch und verlangt GENAU EINEN Umschlag
   * von „ablehnen" auf „annehmen" — und dass beide Seiten wirklich vorkommen.
   */
  it("kippt genau einmal, wenn der Verkaufserloes steigt", () => {
    const entscheidungen = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20].map(
      (salePrice) =>
        decideAiContractDissolution(lage({ offer: offer({ salePrice }), remainingYears: 0, salary: 5 })).decision,
    );
    expect(entscheidungen).toContain("declined");
    expect(entscheidungen).toContain("accepted");
    const wechsel = entscheidungen.filter((wert, index) => index > 0 && wert !== entscheidungen[index - 1]).length;
    expect(wechsel).toBe(1);
    // Und die Richtung stimmt: teurer Abgang = eher annehmen.
    expect(entscheidungen[0]).toBe("declined");
    expect(entscheidungen[entscheidungen.length - 1]).toBe("accepted");
  });

  it("laesst einen schwachen Spieler eher ziehen als einen starken desselben Kaders", () => {
    const grenzfall = { offer: offer({ salePrice: 15 }), remainingYears: 0, salary: 5 };
    const schwach = decideAiContractDissolution(lage({ ...grenzfall, qualityShareInTeam: 0 }));
    const stark = decideAiContractDissolution(lage({ ...grenzfall, qualityShareInTeam: 1 }));
    expect(stark.keepWorth).toBeGreaterThan(schwach.keepWorth);
    expect(schwach.decision).toBe("accepted");
    expect(stark.decision).toBe("declined");
  });

  it("haelt einen Spieler eher, wenn der Kader nach dem Abgang duenn waere — aber ohne harte Sperre", () => {
    const grenzfall = { offer: offer({ salePrice: 15 }), remainingYears: 0, salary: 5, qualityShareInTeam: 0.7 };
    const vollerKader = decideAiContractDissolution(lage({ ...grenzfall, rosterBefore: 14, playerOpt: 11 }));
    const duennerKader = decideAiContractDissolution(lage({ ...grenzfall, rosterBefore: 9, playerOpt: 11 }));
    expect(duennerKader.rosterFactor).toBeGreaterThan(vollerKader.rosterFactor);
    expect(vollerKader.decision).toBe("accepted");
    expect(duennerKader.decision).toBe("declined");
  });

  /**
   * CHRIS: „Doch KI darf unter minimum aufloesen weil sie danach ja noch kaufen!" Die
   * Mindestkadergroesse ist ein Gewicht, keine Sperre — ein klar guter Abgang geht auch dann
   * durch, wenn das Team dadurch unter das Minimum faellt.
   */
  it("loest auch unter die Mindestkadergroesse auf, wenn der Abgang klar besser ist", () => {
    const entscheidung = decideAiContractDissolution(
      lage({
        offer: offer({ salePrice: 40 }),
        rosterBefore: 8,
        playerMin: 8,
        playerOpt: 10,
        qualityShareInTeam: 0.2,
      }),
    );
    expect(entscheidung.rosterAfter).toBeLessThan(entscheidung.playerMin);
    expect(entscheidung.decision).toBe("accepted");
  });

  /**
   * DIE PLEITE-WACHE. Eine Aufloesung KANN netto Geld kosten: langer teurer Vertrag, magerer
   * Verkaufserloes — dann uebersteigt der zahlbare Rest-Buyout den Erloes. Ein Team darf sich
   * daran nicht in ein Loch entlassen, aus dem es in der folgenden Kaufphase nicht mehr
   * einkaufen kann.
   */
  it("lehnt ab, wenn die Aufloesung netto Geld kostet und die Kasse das nicht traegt", () => {
    const teuer = offer({ salePrice: 5, openBuyout: 40, waivedBuyout: 15, payableBuyout: 25 });
    const entscheidung = decideAiContractDissolution(lage({ offer: teuer, cashBefore: 10 }));
    expect(entscheidung.netCash).toBe(-20);
    expect(entscheidung.decision).toBe("declined");
    expect(entscheidung.reason).toBe("cash_floor");
  });

  it("zahlt denselben Rest-Buyout, wenn die Kasse ihn traegt", () => {
    const teuer = offer({ salePrice: 5, openBuyout: 40, waivedBuyout: 15, payableBuyout: 25 });
    // Kasse 60 traegt die 20; ob dann angenommen wird, entscheidet die Abwaegung — nicht die Wache.
    const entscheidung = decideAiContractDissolution(lage({ offer: teuer, cashBefore: 60 }));
    expect(entscheidung.reason).not.toBe("cash_floor");
  });

  it("darf aus dem Minus heraus annehmen, solange die Aufloesung Geld BRINGT", () => {
    const entscheidung = decideAiContractDissolution(lage({ cashBefore: -21.7 }));
    expect(entscheidung.netCash).toBeGreaterThan(0);
    expect(entscheidung.reason).not.toBe("cash_floor");
    expect(entscheidung.decision).toBe("accepted");
  });

  /**
   * Laeuft der Vertrag an diesem Saisonende ohnehin aus und will die Vertrags-Vorschau ihn
   * NICHT verlaengern, haelt eine Ablehnung den Spieler keinen Tag laenger — er geht beim
   * Vertrags-Tick mit demselben Erloes. Behalten hat dann keinen Wert.
   */
  it("nimmt an, wenn der Vertrag ohnehin endet und niemand verlaengert", () => {
    const entscheidung = decideAiContractDissolution(
      lage({ remainingYears: 0, salary: 0, renewal: { wouldRenew: false, renewalSalary: 6, renewalLength: 2 } }),
    );
    expect(entscheidung.keepWorth).toBe(0);
    expect(entscheidung.decision).toBe("accepted");
    expect(entscheidung.reason).toBe("contract_ends_anyway");
  });

  it("lehnt denselben Fall ab, wenn die Vorschau ihn verlaengern will und das billig ist", () => {
    const entscheidung = decideAiContractDissolution(
      lage({
        offer: offer({ salePrice: 6 }),
        remainingYears: 0,
        salary: 0,
        renewal: { wouldRenew: true, renewalSalary: 1, renewalLength: 2 },
      }),
    );
    // Marktwert 20 minus 2 x 1 Verlaengerungskosten = 18 Restwert vor den Faktoren.
    expect(entscheidung.keepWorth).toBeGreaterThan(entscheidung.exitGain);
    expect(entscheidung.decision).toBe("declined");
    expect(entscheidung.reason).toBe("renewal_wanted");
  });

  it("nimmt denselben Fall wieder an, wenn die Verlaengerung teuer waere", () => {
    const entscheidung = decideAiContractDissolution(
      lage({
        offer: offer({ salePrice: 6 }),
        remainingYears: 0,
        salary: 0,
        renewal: { wouldRenew: true, renewalSalary: 9, renewalLength: 2 },
      }),
    );
    // Marktwert 20 minus 18 Verlaengerungskosten = 2 Restwert.
    expect(entscheidung.decision).toBe("accepted");
  });

  it("bewertet einen unzufriedeneren Spieler niedriger — aber nie unter den Boden", () => {
    const knappUnterSchwelle = decideAiContractDissolution(lage({ offer: offer({ morale: 33 }) }));
    const ganzUnten = decideAiContractDissolution(lage({ offer: offer({ morale: 1 }) }));
    expect(ganzUnten.moraleFactor).toBeLessThan(knappUnterSchwelle.moraleFactor);
    expect(ganzUnten.moraleFactor).toBeGreaterThanOrEqual(AI_DISSOLUTION_MORALE_FLOOR);
  });
});

describe("Qualitaetsanteil im eigenen Kader", () => {
  it("gibt dem schlechtesten 0 und dem besten 1", () => {
    const werte = [5, 10, 20, 40];
    expect(resolveQualityShareInTeam(werte, 5)).toBe(0);
    expect(resolveQualityShareInTeam(werte, 40)).toBe(1);
    expect(resolveQualityShareInTeam(werte, 20)).toBeCloseTo(2 / 3, 5);
  });

  it("faellt bei einem Ein-Mann-Kader auf die Mitte zurueck statt 0 zu behaupten", () => {
    expect(resolveQualityShareInTeam([12], 12)).toBe(0.5);
  });
});

/**
 * Der Lauf ueber die Liga: derselbe Dienst wie beim Menschen, dieselbe Buchung, und das
 * Managerteam bleibt unangetastet.
 */
describe("Der Lauf ueber alle Teams", () => {
  function liga() {
    return {
      season: { id: "season-2", name: "Season 2" },
      gamePhase: "season_completed",
      matchdayState: { matchdayId: "md-10" },
      disciplines: [],
      players: [
        { id: "p-ki", name: "KI-Spieler", marketValue: 20, displayMarketValue: 20, subclasses: [], traits: [], traitsPositive: [], traitsNegative: [], coreStats: { pow: 50, spe: 50, men: 50, soc: 50 }, disciplineRatings: {} },
        { id: "p-mensch", name: "Mensch-Spieler", marketValue: 20, displayMarketValue: 20, subclasses: [], traits: [], traitsPositive: [], traitsNegative: [], coreStats: { pow: 50, spe: 50, men: 50, soc: 50 }, disciplineRatings: {} },
        { id: "p-froh", name: "Zufriedener", marketValue: 20, displayMarketValue: 20, subclasses: [], traits: [], traitsPositive: [], traitsNegative: [], coreStats: { pow: 50, spe: 50, men: 50, soc: 50 }, disciplineRatings: {} },
      ],
      rosters: [
        { id: "r1", teamId: "A-A", playerId: "p-ki", contractLength: 1, salary: 4, purchasePrice: 10 },
        { id: "r2", teamId: "A-A", playerId: "p-froh", contractLength: 3, salary: 4, purchasePrice: 10 },
        { id: "r3", teamId: "S-C", playerId: "p-mensch", contractLength: 1, salary: 4, purchasePrice: 10 },
      ],
      teams: [
        { teamId: "A-A", name: "KI-Team", cash: 50, humanControlled: false },
        { teamId: "S-C", name: "Managerteam", cash: 50, humanControlled: true },
      ],
      teamIdentities: [],
      playerMoraleState: [
        { teamId: "A-A", playerId: "p-ki", morale: 20, reasons: [], warnings: [], suggestedActions: [] },
        { teamId: "A-A", playerId: "p-froh", morale: 80, reasons: [], warnings: [], suggestedActions: [] },
        { teamId: "S-C", playerId: "p-mensch", morale: 20, reasons: [], warnings: [], suggestedActions: [] },
      ],
      transferHistory: [],
      seasonState: {
        teamControlSettings: [{ teamId: "S-C", controlMode: "manual" }],
        matchdayResults: [],
        disciplineResults: [],
        playerDisciplinePerformances: [],
        standings: {},
        schedule: [],
        disciplineSchedule: [],
      },
      logs: [],
    } as never;
  }

  it("entscheidet fuer KI-Teams und laesst das Managerteam in Ruhe", () => {
    const run = applyAiContractDissolutions({
      gameState: liga(),
      saveId: "save-1",
      seasonId: "season-2",
      decidedAt: "2026-08-12T00:00:00.000Z",
    });
    expect(run.decisions.map((entry) => entry.teamId)).toEqual(["A-A"]);
    expect(run.decisions.map((entry) => entry.playerId)).toEqual(["p-ki"]);
    expect(run.acceptedCount + run.declinedCount).toBe(1);
  });

  it("bucht eine Annahme als contract_exit mit der tatsaechlichen Kassenwirkung", () => {
    const run = applyAiContractDissolutions({
      gameState: liga(),
      saveId: "save-1",
      seasonId: "season-2",
      decidedAt: "2026-08-12T00:00:00.000Z",
    });
    const entscheidung = run.decisions[0];
    if (entscheidung.decision !== "accepted") {
      throw new Error(`Fixture erwartet eine Annahme, bekam ${entscheidung.decision}/${entscheidung.reason}`);
    }

    const buchungen = (run.gameState.transferHistory ?? []).filter(
      (entry) => entry.source === CONTRACT_DISSOLUTION_TRANSFER_SOURCE,
    );
    expect(buchungen).toHaveLength(1);
    // Bewusst KEIN "sell": das wuerde zusaetzlich die Wiederkauf-Sperre ausloesen.
    expect(buchungen[0].transferType).toBe("contract_exit");
    expect(buchungen[0].fromTeamId).toBe("A-A");
    expect(buchungen[0].netCashImpact).toBe(entscheidung.netCash);

    // Kasse und Buchung sagen dasselbe — sonst geht das Hauptbuch nicht auf.
    const kasseNachher = run.gameState.teams.find((team) => team.teamId === "A-A")?.cash ?? 0;
    expect(kasseNachher).toBeCloseTo(50 + entscheidung.netCash, 2);
    // Und der Spieler ist wirklich raus.
    expect(run.gameState.rosters.some((entry) => entry.playerId === "p-ki")).toBe(false);
  });

  it("schreibt fuer jede Entscheidung genau einen Log-Eintrag — auch bei Ablehnung", () => {
    const run = applyAiContractDissolutions({
      gameState: liga(),
      saveId: "save-1",
      seasonId: "season-2",
      decidedAt: "2026-08-12T00:00:00.000Z",
    });
    const log = (run.gameState.seasonState as { contractDissolutions?: unknown[] }).contractDissolutions ?? [];
    expect(log).toHaveLength(1);
  });

  it("entscheidet einen Spieler nicht zweimal in derselben Saison", () => {
    const erst = applyAiContractDissolutions({
      gameState: liga(),
      saveId: "save-1",
      seasonId: "season-2",
      decidedAt: "2026-08-12T00:00:00.000Z",
    });
    const zweit = applyAiContractDissolutions({
      gameState: erst.gameState,
      saveId: "save-1",
      seasonId: "season-2",
      decidedAt: "2026-08-12T00:00:00.000Z",
    });
    expect(zweit.decisions).toHaveLength(0);
  });
});
