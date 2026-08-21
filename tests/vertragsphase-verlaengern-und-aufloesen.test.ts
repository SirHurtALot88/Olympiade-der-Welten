/**
 * GEMELDET VON CHRIS, zwei Sachen an derselben Stelle.
 *
 * 1. „ich kann die verträge im aktuellen save nicht verlängern obwohl wir in der vertrags phase
 *    sind!" — und: „es steht ja sogar dort dass vertrag ausläuft, also wundert es mich dass es
 *    nicht klappt."
 *
 * 2. „spieler bei denen der vertrag sowieso nun ausläuft sollten keine vertragsauflösung
 *    anbieten! sonst kann man sich ja das bessere aussuchen — das ist nur für spieler die noch
 *    restvertrag haben!"
 *
 * Beides hing an derselben Verwechslung: `contractLength` zaehlt die Saisons EINSCHLIESSLICH der
 * laufenden. Eine 1 ist die letzte Vertragssaison, nicht „noch ein Jahr Luft".
 */
import { describe, expect, it } from "vitest";

import {
  istVertragAmAuslaufen,
  normalizeRosterContractStatus,
} from "@/lib/contracts/roster-contract-status";
import { buildContractDissolutionOffers } from "@/lib/morale/contract-dissolution-service";

describe("Die Bedeutung der Laufzeit", () => {
  it("liest 1 als letzte Vertragssaison, nicht als laufenden Vertrag", () => {
    expect(normalizeRosterContractStatus({ contractLength: 3 })).toBe("active");
    expect(normalizeRosterContractStatus({ contractLength: 2 })).toBe("active");
    expect(normalizeRosterContractStatus({ contractLength: 1 })).toBe("expiring");
    expect(normalizeRosterContractStatus({ contractLength: 0 })).toBe("out_of_contract");
  });

  it("zaehlt genau die Zustaende ohne Restvertrag als auslaufend", () => {
    expect(istVertragAmAuslaufen({ contractLength: 1 })).toBe(true);
    expect(istVertragAmAuslaufen({ contractLength: 0 })).toBe(true);
    expect(istVertragAmAuslaufen({ contractLength: 2, contractStatus: "renewal_pending" })).toBe(true);
    expect(istVertragAmAuslaufen({ contractLength: 2 })).toBe(false);
    expect(istVertragAmAuslaufen({ contractLength: 5 })).toBe(false);
  });
});

/** Ein Spielstand mit genau einem unzufriedenen Spieler, dessen Laufzeit der Test setzt. */
function baueSpielstand(contractLength: number) {
  const player = {
    id: "p-1",
    name: "Testspieler",
    marketValue: 40,
    displayMarketValue: 40,
    salaryDemand: 8,
    displaySalary: 8,
  } as never;
  return {
    gameState: {
      season: { id: "season-1", seasonNumber: 1 },
      players: [player],
      teams: [{ teamId: "A-A", name: "Alpha", cash: 100 }],
      rosters: [
        {
          id: "r-1",
          teamId: "A-A",
          playerId: "p-1",
          salary: 8,
          upkeep: 8,
          contractLength,
          purchasePrice: 20,
        },
      ],
      seasonState: {},
    } as never,
  };
}

describe("Vertragsaufloesung nur bei Restvertrag", () => {
  const eingabe = (contractLength: number) => ({
    gameState: baueSpielstand(contractLength).gameState,
    teamId: "A-A",
    seasonId: "season-1",
    // Weit unter der Schwelle — ohne die Laufzeit-Regel gaebe es hier sicher ein Angebot.
    moraleByPlayerId: { "p-1": 5 },
  });

  it("bietet einem laufenden Vertrag eine Aufloesung an", () => {
    const angebote = buildContractDissolutionOffers(eingabe(3) as never);
    expect(angebote).toHaveLength(1);
    expect(angebote[0]!.playerId).toBe("p-1");
  });

  it("bietet einem auslaufenden Vertrag KEINE Aufloesung an", () => {
    // Ohne die Regel waere hier der offene Buyout 0 (der Preis rechnet mit contractLength − 1)
    // und der volle Verkaufserloes bliebe uebrig — ein geschenkter Gewinn statt einer Entscheidung.
    expect(buildContractDissolutionOffers(eingabe(1) as never)).toHaveLength(0);
  });

  it("bietet einem abgelaufenen Vertrag erst recht keine an", () => {
    expect(buildContractDissolutionOffers(eingabe(0) as never)).toHaveLength(0);
  });
});
