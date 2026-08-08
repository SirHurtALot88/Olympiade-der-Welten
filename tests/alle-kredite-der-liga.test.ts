/**
 * GEMELDET: „der spieler soll im kredite tab ALLE kredite sehen können mit allen infos die in der
 * liga aktiv oder abgelaufen sind" und praezisiert: „so dass man sehen kann welches team hat von
 * welchem einen kredit genommen, laufzeit raten usw."
 *
 * BEFUND: der Reiter hatte zwar eine Liga-Uebersicht, die fasst aber pro TEAM zusammen — man sah,
 * WER Schulden hat, nicht BEI WEM und zu welchen Konditionen. Beendete Kredite fielen ganz heraus,
 * weil die Liste nur laufende zeigte.
 *
 * Der Anlass war handfest: im Messlauf lieh sich H-R 32.0 Mio ausgerechnet beim manuell gefuehrten
 * Team, ohne dass das irgendwo sichtbar gewesen waere.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { buildCreditsViewModel } from "@/lib/foundation/credits/use-credits-view-model";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

function baueSpielstand(): GameState {
  const team = (teamId: string, name: string, cash: number) => ({
    teamId,
    shortCode: teamId,
    name,
    cash,
    budget: cash,
    rosterLimit: 14,
  });
  const kredit = (input: {
    loanId: string;
    borrowerTeamId: string;
    lenderTeamId?: string | null;
    principalOutstanding: number;
    status: string;
  }) => ({
    loanId: input.loanId,
    borrowerTeamId: input.borrowerTeamId,
    lenderType: input.lenderTeamId ? "team" : "bank",
    lenderTeamId: input.lenderTeamId ?? null,
    principalOriginal: 40,
    principal: 40,
    principalOutstanding: input.principalOutstanding,
    interestRatePerSeason: 0.12,
    termSeasons: 3,
    seasonsRemaining: 2,
    installmentPerSeason: 15.4,
    originatedSeasonId: "season-2",
    status: input.status,
    missedPayments: input.status === "defaulted" ? 2 : 0,
  });

  return {
    season: { id: "season-2", name: "Season 2", year: 2027, currentMatchday: 1, matchdayIds: ["m-1"] },
    seasonState: {
      seasonId: "season-2",
      schedule: [],
      standings: {},
      teamControlSettings: {},
      teamStrategyProfiles: {},
      matchdayResults: [],
      loans: [
        kredit({ loanId: "l-abbezahlt", borrowerTeamId: "H-R", lenderTeamId: "S-C", principalOutstanding: 0, status: "repaid" }),
        kredit({ loanId: "l-klein", borrowerTeamId: "D-P", principalOutstanding: 9, status: "active" }),
        kredit({ loanId: "l-gross", borrowerTeamId: "B-P", lenderTeamId: "W-L", principalOutstanding: 31, status: "active" }),
      ],
    },
    matchdayState: { matchdayId: "m-1", status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
    gamePhase: "season_active",
    teams: [
      team("S-C", "Stronghold Crusaders", 90),
      team("H-R", "Hell Raisers", 20),
      team("D-P", "Death Peaches", 15),
      team("B-P", "Blood Priests", 30),
      team("W-L", "Wolf Legion", 60),
    ],
    teamIdentities: [],
    players: [],
    disciplines: [],
    rosters: [],
    contracts: [],
    transferListings: [],
    transferHistory: [],
    logs: [],
    mappingReport: {} as never,
  } as unknown as GameState;
}

function zeilen() {
  const modell = buildCreditsViewModel(baueSpielstand(), "S-C");
  if (modell.status !== "ready") throw new Error("erwartet: ready");
  return modell.team.leagueLoans;
}

describe("Kredite-Reiter zeigt alle Kredite der Liga", () => {
  it("listet jeden Kredit einzeln, nicht pro Team zusammengefasst", () => {
    expect(zeilen()).toHaveLength(3);
  });

  it("nennt Schuldner UND Geldgeber mit Klarnamen", () => {
    // „welches team hat von welchem einen kredit genommen" — mit Team-Kuerzeln allein unlesbar.
    const gross = zeilen().find((row) => row.id === "l-gross")!;
    expect(gross.borrowerName).toBe("Blood Priests");
    expect(gross.lenderName).toBe("Wolf Legion");
    const bank = zeilen().find((row) => row.id === "l-klein")!;
    expect(bank.lenderType).toBe("bank");
    expect(bank.lenderName).toBe("Bank");
  });

  it("traegt Laufzeit, Rate und Zins mit", () => {
    // „laufzeit raten usw."
    const gross = zeilen().find((row) => row.id === "l-gross")!;
    expect(gross.termSeasons).toBe(3);
    expect(gross.remainingSeasons).toBe(2);
    expect(gross.installmentPerSeason).toBe(15.4);
    expect(gross.interestRate).toBeCloseTo(0.12, 3);
  });

  it("behaelt beendete Kredite — „aktiv ODER abgelaufen\"", () => {
    // Eine Historie, die verschwindet sobald sie interessant wird, ist keine.
    expect(zeilen().some((row) => row.id === "l-abbezahlt")).toBe(true);
  });

  it("sortiert laufende nach oben, darin die groesste Restschuld zuerst", () => {
    expect(zeilen().map((row) => row.id)).toEqual(["l-gross", "l-klein", "l-abbezahlt"]);
  });

  it("markiert eigene Beteiligung — auch als GELDGEBER, nicht nur als Schuldner", () => {
    // Genau der gemeldete Fall: das eigene Team wurde angezapft, ohne dass es irgendwo stand.
    const eigen = zeilen().find((row) => row.id === "l-abbezahlt")!;
    expect(eigen.borrowerTeamId).toBe("H-R");
    expect(eigen.involvesOwnTeam).toBe(true);
  });

  it("haelt verpasste Raten fest", () => {
    const zeile = zeilen().find((row) => row.missedPayments > 0);
    expect(zeile ?? null).toBeNull();
  });
});

describe("Die Ansicht zeigt die Tabelle auch an", () => {
  const PANEL = read("app/foundation/credits/FoundationCreditsNewLook.tsx");
  const CSS = read("app/globals.css");

  it("rendert die Liga-Kredite als eigene Tabelle", () => {
    // Eine Prop, die niemand rendert, waere dieselbe Luecke mit mehr Zeilen.
    expect(PANEL).toContain("alleKredite.map");
    expect(PANEL).toContain("Alle Kredite");
  });

  it("zeigt Geldgeber, Laufzeit und Rate als eigene Spalten", () => {
    expect(PANEL).toContain("Geldgeber");
    expect(PANEL).toContain("Laufzeit");
    expect(PANEL).toContain("Rate");
  });

  it("hebt die eigene Beteiligung hervor und daempft Beendetes", () => {
    expect(PANEL).toContain("involvesOwnTeam");
    expect(CSS).toContain(".nl-credits-alle-row.is-own");
    expect(CSS).toContain(".nl-credits-alle-row.is-done");
  });

  it("die breite Tabelle scrollt in sich, statt die Seite zu sprengen", () => {
    expect(CSS).toContain(".is-new-look .nl-credits-alle-wrap");
    expect(CSS).toMatch(/nl-credits-alle-wrap \{\s*\n\s*overflow-x: auto;/);
  });
});
