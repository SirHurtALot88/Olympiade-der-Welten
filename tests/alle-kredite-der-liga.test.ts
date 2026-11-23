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
import { baueKreditSeitenModell } from "@/lib/finance/kredite-seite-modell";

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
  const modell = baueKreditSeitenModell(baueSpielstand(), "S-C");
  if (!modell) throw new Error("erwartet: Modell");
  return modell.register;
}

describe("Kredite-Reiter zeigt alle Kredite der Liga (Register)", () => {
  it("listet jeden Kredit einzeln, nicht pro Team zusammengefasst", () => {
    expect(zeilen()).toHaveLength(3);
  });

  it("nennt Schuldner UND Geldgeber mit Klarnamen", () => {
    // „welches team hat von welchem einen kredit genommen" — mit Team-Kuerzeln allein unlesbar.
    const gross = zeilen().find((row) => row.loanId === "l-gross")!;
    expect(gross.nehmerName).toBe("Blood Priests");
    expect(gross.geberName).toBe("Wolf Legion");
    const bank = zeilen().find((row) => row.loanId === "l-klein")!;
    expect(bank.geberId).toBeNull();
    expect(bank.geberName).toBe("Bank");
  });

  it("traegt Zins, Rate und Restlaufzeit mit", () => {
    // „laufzeit raten usw." Ohne Raten-Stempel gilt bis zum Saisonwechsel die Jahresrate am Saisonende.
    const gross = zeilen().find((row) => row.loanId === "l-gross")!;
    expect(gross.rateJeSaison).toBe(15.4);
    expect(gross.ratenOffen).toBeGreaterThan(0);
    expect(gross.zins).toBeCloseTo(0.12, 3);
  });

  it("behaelt beendete Kredite — „aktiv ODER abgelaufen\"", () => {
    // Eine Historie, die verschwindet sobald sie interessant wird, ist keine.
    expect(zeilen().some((row) => row.loanId === "l-abbezahlt")).toBe(true);
  });

  it("markiert eigene Beteiligung — auch als GELDGEBER, nicht nur als Schuldner", () => {
    // Genau der gemeldete Fall: das eigene Team wurde angezapft, ohne dass es irgendwo stand.
    const eigen = zeilen().find((row) => row.loanId === "l-abbezahlt")!;
    expect(eigen.nehmerId).toBe("H-R");
    expect(eigen.eigene).toBe(true);
  });

  it("zeigt die Kasse fremder Teams nirgends (Fog of War)", () => {
    const modell = baueKreditSeitenModell(baueSpielstand(), "S-C")!;
    for (const zeile of modell.liga) expect(Object.keys(zeile)).not.toContain("kasse");
    for (const zeile of modell.register) expect(Object.keys(zeile)).not.toContain("kasse");
  });
});

describe("Die Seite zeigt Tabelle und Register an", () => {
  const SEITE = read("app/foundation/finances/FinanzenKredite.tsx");

  it("rendert das Register als eigene Tabelle mit Nehmer und Geber", () => {
    // Eine Prop, die niemand rendert, waere dieselbe Luecke mit mehr Zeilen.
    expect(SEITE).toContain("kre-register");
    expect(SEITE).toContain("Nehmer");
    expect(SEITE).toContain("Geber");
  });

  it("alle Tabellen sind sortierbar", () => {
    expect(SEITE.match(/useTabellenSortierung/g)?.length ?? 0).toBeGreaterThanOrEqual(4);
  });
});
