import { describe, expect, it } from "vitest";

import { sortLeagueSponsorRows, type LeagueSponsorSortRow } from "@/lib/sponsor/sponsor-offer-presenter";

/**
 * Liga-Sponsorenübersicht (#78): der gewaehlte Sortier-Modus bestimmt die
 * Reihenfolge allein. Regression: Golden-Card-Zeilen wurden unabhaengig vom
 * Modus nach ganz oben gezogen, wodurch im Cash-Modus ein Golden-Team mit
 * kleinem Betrag (39,0) zwischen den groessten Betraegen (123,9 / 112,3) stand
 * und die Liste sichtbar nicht mehr absteigend war.
 */
function row(overrides: Partial<LeagueSponsorSortRow> & { teamName: string }): LeagueSponsorSortRow {
  return {
    sponsorName: `${overrides.teamName} Sponsor`,
    rarity: "gewöhnlich",
    projectedCash: 0,
    isGolden: false,
    ...overrides,
  };
}

describe("league sponsor overview sort", () => {
  it("sorts by cash strictly descending even when a golden row is worth little", () => {
    const rows = [
      row({ teamName: "Wrecking Legionnaires", projectedCash: 112.3 }),
      row({ teamName: "Vigilante Wranglers", projectedCash: 39.0, isGolden: true }),
      row({ teamName: "Golden Gladiators", projectedCash: 123.9, isGolden: true }),
      row({ teamName: "Black Panthers", projectedCash: 105.7 }),
    ];

    const sorted = sortLeagueSponsorRows(rows, "cash");

    expect(sorted.map((entry) => entry.projectedCash)).toEqual([123.9, 112.3, 105.7, 39.0]);
    // Die kleine Golden-Zeile steht am Ende, nicht mehr auf Platz 2.
    expect(sorted[sorted.length - 1]?.teamName).toBe("Vigilante Wranglers");
  });

  it("keeps teams without a contract at the end of the cash sort", () => {
    const rows = [
      row({ teamName: "Cash Creators", projectedCash: null, sponsorName: null, rarity: null }),
      row({ teamName: "Hermes", projectedCash: 12 }),
      row({ teamName: "Zalando", projectedCash: 0 }),
    ];

    const sorted = sortLeagueSponsorRows(rows, "cash");

    expect(sorted.map((entry) => entry.teamName)).toEqual(["Hermes", "Zalando", "Cash Creators"]);
  });

  it("breaks ties with golden first, then team name", () => {
    const rows = [
      row({ teamName: "Zero Heroes", projectedCash: 80 }),
      row({ teamName: "Alpha Team", projectedCash: 80 }),
      row({ teamName: "Mid Team", projectedCash: 80, isGolden: true }),
    ];

    const sorted = sortLeagueSponsorRows(rows, "cash");

    expect(sorted.map((entry) => entry.teamName)).toEqual(["Mid Team", "Alpha Team", "Zero Heroes"]);
  });

  it("sorts by rarity order without golden jumping the queue", () => {
    const rows = [
      row({ teamName: "Common Golden", rarity: "gewöhnlich", isGolden: true }),
      row({ teamName: "Legendary Plain", rarity: "legendär" }),
      row({ teamName: "Rare Plain", rarity: "selten" }),
    ];

    const sorted = sortLeagueSponsorRows(rows, "tier");

    expect(sorted.map((entry) => entry.teamName)).toEqual(["Legendary Plain", "Rare Plain", "Common Golden"]);
  });

  it("sorts by team and sponsor name alphabetically, contract-less rows last", () => {
    const rows = [
      row({ teamName: "Zero Heroes", sponsorName: "Zalando" }),
      row({ teamName: "Alpha Team", sponsorName: null, isGolden: true }),
      row({ teamName: "Mid Team", sponsorName: "Adobe" }),
    ];

    expect(sortLeagueSponsorRows(rows, "team").map((entry) => entry.teamName)).toEqual([
      "Alpha Team",
      "Mid Team",
      "Zero Heroes",
    ]);
    expect(sortLeagueSponsorRows(rows, "sponsor").map((entry) => entry.sponsorName)).toEqual([
      "Adobe",
      "Zalando",
      null,
    ]);
  });

  it("does not mutate the input array", () => {
    const rows = [row({ teamName: "B", projectedCash: 1 }), row({ teamName: "A", projectedCash: 2 })];
    const snapshot = rows.map((entry) => entry.teamName);

    sortLeagueSponsorRows(rows, "cash");

    expect(rows.map((entry) => entry.teamName)).toEqual(snapshot);
  });
});
