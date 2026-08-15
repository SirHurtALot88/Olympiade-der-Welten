import { describe, expect, it } from "vitest";

import {
  formatContractShapeLabel,
  formatContractShapeShortLabel,
  resolvePlayerEconomyContract,
  rosterSalariesDifferForDisplay,
} from "@/lib/foundation/player-economy-contract";
import type { Player, RosterEntry } from "@/lib/data/olyDataTypes";

function buildPlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: "player-1",
    name: "Torgar",
    rating: 0,
    marketValue: 75000,
    salaryDemand: 8000,
    displayMarketValue: 62.52,
    displaySalary: 16.78,
    pps: null,
    ovr: null,
    className: "Templar",
    race: "Tauren",
    alignment: "neutral",
    gender: "m",
    subclasses: [],
    traitsPositive: ["Fearless", "Disciplined", "Cool"],
    traitsNegative: ["Cruel", "Vindictive", "Mercenary"],
    coreStats: { pow: 76.43, spe: 51.66, men: 63.58, soc: 47.43 },
    attributeSheetStats: {
      power: 86,
      health: 79,
      stamina: 74,
      intelligence: 42,
      awareness: 48,
      determination: 81,
      speed: 33,
      dexterity: 28,
      charisma: 67,
      will: 76,
      spirit: 18,
      torment: 84,
    },
    disciplineRatings: {
      tennis: 80.56,
      "mini-dm": 79.96,
      showcase: 46.79,
      "time-trial": 35.82,
      spurt: 67.4,
      basketball: 33.81,
      tdm: 73.48,
      battlefield: 58.01,
      staffel: 38.88,
      football: 63.72,
      wettessen: 79.12,
      gewichtheben: 76.72,
      "speed-schach": 43.18,
      "takeshis-castle": 67.32,
      hockey: 67.04,
      eiskunstlauf: 34.84,
      climbing: 66.92,
      fechten: 49.3,
      "i-spy": 47.74,
      breaking: 84.94,
    },
    ...overrides,
  };
}

function buildRosterEntry(overrides: Partial<RosterEntry> = {}): RosterEntry {
  return {
    id: "roster-1",
    teamId: "M-M",
    playerId: "player-1",
    contractLength: 3,
    salary: 12.25,
    upkeep: 12.25,
    purchasePrice: 62.52,
    currentValue: 62.52,
    roleTag: "starter",
    joinedSeasonId: "season-1",
    ...overrides,
  };
}

describe("player economy contract", () => {
  it("prefers calculated market value over stale roster book value", () => {
    const economy = resolvePlayerEconomyContract({
      player: buildPlayer({ marketValue: 30.51, displayMarketValue: 30.51 }),
      rosterEntry: buildRosterEntry({ currentValue: 35.82, purchasePrice: 28 }),
    });

    expect(economy.marketValue).toBeCloseTo(30.51, 2);
    expect(economy.marketValueSource).not.toBe("active_current_value");
  });

  it("matches the Torgar benchmark with salary based on the internal market value basis", () => {
    const economy = resolvePlayerEconomyContract({ player: buildPlayer() });

    expect(economy.salaryMarketValue).toBeCloseTo(62.52, 1);
    expect(economy.marketValue).toBeCloseTo(62.5, 1);
    expect(economy.salaryBase).toBeCloseTo(15.3, 1);
    expect(economy.expectedSalary).toBeCloseTo(18.9, 1);
    expect(economy.salarySource).toBe("calculated_preview");
  });

  it("keeps active contract salary stable while expected salary can differ", () => {
    const economy = resolvePlayerEconomyContract({
      player: buildPlayer(),
      rosterEntry: buildRosterEntry({ salary: 11.4 }),
    });

    expect(economy.salary).toBe(11.4);
    expect(economy.salarySource).toBe("active_contract");
    expect(economy.expectedSalary).toBeCloseTo(18.9, 1);
  });

  it("prefers the real year-1 salary from the contract schedule over the legacy roster salary field", () => {
    const economy = resolvePlayerEconomyContract({
      player: buildPlayer(),
      rosterEntry: buildRosterEntry({
        salary: 11.4,
        yearlySalarySchedule: [
          { yearIndex: 1, seasonOffset: 0, label: "Season 1", salary: 14.8 },
          { yearIndex: 2, seasonOffset: 1, label: "Season 2", salary: 11.4 },
          { yearIndex: 3, seasonOffset: 2, label: "Season 3", salary: 7.9 },
        ],
      }),
    });

    expect(economy.salary).toBe(14.8);
    expect(economy.annualSalary).toBe(14.8);
    expect(economy.salarySource).toBe("active_contract");
  });

  it("keeps annual salary separate from current season cash on shaped contracts", () => {
    const economy = resolvePlayerEconomyContract({
      player: buildPlayer({ displaySalary: 18.18, salaryDemand: 18.18 }),
      rosterEntry: buildRosterEntry({
        salary: 18.63,
        contractLength: 4,
        contractShape: "front_loaded",
        yearlySalarySchedule: [
          { yearIndex: 1, seasonOffset: 0, label: "Season 1", salary: 29.81 },
          { yearIndex: 2, seasonOffset: 1, label: "Season 2", salary: 22.36 },
          { yearIndex: 3, seasonOffset: 2, label: "Season 3", salary: 14.9 },
          { yearIndex: 4, seasonOffset: 3, label: "Season 4", salary: 7.45 },
        ],
      }),
    });

    expect(economy.salary).toBe(29.81);
    expect(economy.annualSalary).toBe(18.63);
  });

  it("uses negotiated annual salary for back-loaded contracts", () => {
    const economy = resolvePlayerEconomyContract({
      player: buildPlayer({ displaySalary: 22.29, salaryDemand: 22.29 }),
      rosterEntry: buildRosterEntry({
        salary: 22.79,
        contractLength: 3,
        contractShape: "back_loaded",
        yearlySalarySchedule: [
          { yearIndex: 1, seasonOffset: 0, label: "Season 1", salary: 11.4 },
          { yearIndex: 2, seasonOffset: 1, label: "Season 2", salary: 22.79 },
          { yearIndex: 3, seasonOffset: 2, label: "Season 3", salary: 34.18 },
        ],
      }),
    });

    expect(economy.salary).toBe(11.4);
    expect(economy.annualSalary).toBe(22.79);
  });

  it("normalizes legacy roster salaries stored in cent-scale", () => {
    const economy = resolvePlayerEconomyContract({
      player: buildPlayer(),
      rosterEntry: buildRosterEntry({ salary: 25000 }),
    });

    expect(economy.salary).toBe(250);
    expect(economy.salarySource).toBe("active_contract");
  });

  it("updates expected salary after an attribute upgrade without changing contract salary", () => {
    const rosterEntry = buildRosterEntry({ salary: 11.4 });
    const before = resolvePlayerEconomyContract({ player: buildPlayer(), rosterEntry });
    const after = resolvePlayerEconomyContract({
      player: buildPlayer({
        attributeSheetStats: {
          ...buildPlayer().attributeSheetStats!,
          charisma: 77,
          will: 82,
        },
      }),
      rosterEntry,
      salaryMarketValueOverride: before.salaryMarketValue,
      baseMarketValueOverride: before.baseMarketValue,
    });

    expect(after.salary).toBe(11.4);
    expect((after.expectedSalary ?? 0)).toBeGreaterThan(before.expectedSalary ?? 0);
  });

  it("formats contract shape badges for roster tables", () => {
    expect(formatContractShapeShortLabel("front_loaded")).toBe("FL");
    expect(formatContractShapeShortLabel("back_loaded")).toBe("BL");
    expect(formatContractShapeShortLabel("balanced")).toBeNull();
    expect(formatContractShapeShortLabel(null)).toBeNull();
    expect(formatContractShapeLabel("balanced")).toBe("Ausgeglichen");
    expect(formatContractShapeLabel("front_loaded")).toBe("Vorne schwer");
    expect(formatContractShapeLabel(null)).toBe("—");
  });

  it("detects when shaped contracts need a season salary subline", () => {
    expect(rosterSalariesDifferForDisplay(29.81, 18.63)).toBe(true);
    expect(rosterSalariesDifferForDisplay(11.4, 22.79)).toBe(true);
    expect(rosterSalariesDifferForDisplay(18.63, 18.63)).toBe(false);
    expect(rosterSalariesDifferForDisplay(null, 18.63)).toBe(false);
  });
});

/**
 * KEINE IMPORT-GEHAELTER MEHR — CHRIS: „keine import gehälter mehr nutzen nicht in tests und
 * nicht im gehalt, nur noch das berechnete!"
 *
 * Die Gehaltskette endete frueher auf `displaySalary`, dem Anzeigewert aus der Katalog-Ausleitung.
 * Dieser Block haelt fest, dass der Zweig weg ist — und er ist so gebaut, dass er es WIRKLICH
 * misst: nur wenn die Rechnung nicht laufen kann (keine Attributwerte, kein gespeicherter
 * berechneter Wert), kommt die Kette ueberhaupt bis dorthin, wo der Import frueher stand.
 *
 * An einem frischen Spielstand gemessen war die Entfernung folgenlos: von 2.984 Spielern haengt
 * KEINER am Import (2.983 `calculated_preview`, einer `active_contract`), und importiertes wie
 * berechnetes Gehalt weichen um 0,00 ab — die Katalogladung materialisiert die berechnete
 * Oekonomie ohnehin zuerst.
 */
describe("Gehalt: der Import ist kein Rueckfall mehr", () => {
  /** Ein Spieler, fuer den die Gehaltsformel nichts hergibt — nur der Anzeigewert steht da. */
  function nurImportSpieler(): Player {
    const player = buildPlayer({ displaySalary: 19.5 });
    return {
      ...player,
      salaryDemand: null,
      attributeSheetStats: null,
    } as unknown as Player;
  }

  it("meldet `missing_salary` statt heimlich den Anzeigewert zu nehmen", () => {
    const contract = resolvePlayerEconomyContract({ player: nurImportSpieler(), playerId: "player-1" });

    expect(contract.salary, "der importierte Anzeigewert darf nicht mehr durchschlagen").toBeNull();
    expect(contract.salarySource).toBe("missing_source");
    expect(contract.expectedSalary).toBeNull();
    expect(contract.economyStatus).toBe("missing_salary");
  });

  it("nimmt weiterhin den unterschriebenen Vertrag, wenn es einen gibt", () => {
    const rosterEntry = {
      id: "r-1",
      teamId: "A-A",
      playerId: "player-1",
      contractLength: 3,
      salary: 12.5,
      upkeep: 12.5,
      purchasePrice: 40,
      currentValue: 40,
      roleTag: "starter",
      joinedSeasonId: "season-1",
    } as unknown as RosterEntry;

    const contract = resolvePlayerEconomyContract({
      player: nurImportSpieler(),
      playerId: "player-1",
      rosterEntry,
    });

    expect(contract.salary).toBe(12.5);
    expect(contract.salarySource).toBe("active_contract");
  });

  it("nimmt die Rechnung, sobald sie laeuft — und nicht den Anzeigewert daneben", () => {
    // Vollstaendiger Spieler: die Formel greift, der Anzeigewert (16.78) steht daneben und
    // gewinnt nicht.
    const contract = resolvePlayerEconomyContract({ player: buildPlayer(), playerId: "player-1" });

    expect(contract.salarySource).toBe("calculated_preview");
    expect(contract.salary).not.toBe(16.78);
    expect(contract.salary).toBe(contract.expectedSalary);
  });
});
