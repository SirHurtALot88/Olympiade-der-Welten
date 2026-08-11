/**
 * DIE RÜCKNAHME DER ZWANGS-NOTKREDITE — die Reparatur für Chris' Spielstand.
 *
 * Chris: „bitte vollzieh das mal nach und lass uns das savegame fixen."
 *
 * Zwei Dinge müssen stimmen, sonst ist die Reparatur schlimmer als der Schaden:
 *   1. Sie muss EXAKT umkehren, was `originateLoan` getan hat — Cash, Kredit, Origination-Log.
 *   2. Sie darf KEINEN freiwillig aufgenommenen Kredit mitreißen. Am Abbild gibt es genau so einen
 *      Fall (Zombie Horde, Bank, Laufzeit 2, Zinsen bereits kapitalisiert), und der muss stehen
 *      bleiben.
 */

import { describe, expect, it } from "vitest";

import type { GameState, LoanRecord, Team } from "@/lib/data/olyDataTypes";
import { INSOLVENCY_BACKSTOP_TERM_SEASONS } from "@/lib/finance/loan-service";
import { planeNotkreditRuecknahme } from "@/lib/finance/notkredit-ruecknahme";

const SEASON_ID = "season-2";

function createTeam(teamId: string, cash: number): Team {
  return {
    teamId,
    shortCode: teamId,
    name: teamId,
    budget: 100,
    cash,
    identityId: teamId,
    humanControlled: false,
    rosterLimit: 12,
    logoPath: null,
  };
}

/** Ein Zwangs-Notkredit, wie der Ausgleich ihn hinterlassen hat: unberührt, Laufzeit 4. */
function notkredit(teamId: string, principal: number): LoanRecord {
  return {
    loanId: `loan:${SEASON_ID}:${teamId}:notkredit`,
    borrowerTeamId: teamId,
    lenderType: "bank",
    principalOriginal: principal,
    principalOutstanding: principal,
    interestRatePerSeason: 0.16,
    installmentPerSeason: principal / 3,
    termSeasons: INSOLVENCY_BACKSTOP_TERM_SEASONS,
    seasonsRemaining: INSOLVENCY_BACKSTOP_TERM_SEASONS,
    originatedSeasonId: SEASON_ID,
    status: "active",
    missedPayments: 0,
  };
}

function createGameState(input: { teams: Team[]; loans: LoanRecord[] }): GameState {
  return {
    season: { id: SEASON_ID, name: "Season 2", year: 2027, currentMatchday: 10, matchdayIds: ["matchday-1"] },
    seasonState: {
      seasonId: SEASON_ID,
      schedule: [],
      standings: Object.fromEntries(input.teams.map((team) => [team.teamId, { points: 0 }])),
      loans: input.loans,
      loanApplyLogs: [],
      loanOriginationLogs: input.loans.map((loan) => ({
        loanId: loan.loanId,
        seasonId: SEASON_ID,
        borrowerTeamId: loan.borrowerTeamId,
        borrowerCashDelta: loan.principalOriginal,
        lenderType: loan.lenderType,
        principal: loan.principalOriginal,
        createdAt: "2026-08-04T06:00:00.000Z",
      })),
      sponsorPayoutLogs: [],
    },
    matchdayState: { matchdayId: "matchday-1", status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams: input.teams,
    teamIdentities: [],
    players: [],
    disciplines: [],
    rosters: [],
    contracts: [],
    transferListings: [],
    transferHistory: [],
    logs: [],
    mappingReport: {
      mappingSource: "",
      teamSource: "",
      generatedAt: "",
      processedMappingRows: 0,
      importedPlayerCount: 0,
      matchedRosterCount: 0,
      teamCount: input.teams.length,
      unmappedPlayers: [],
      teamsWithoutPlayers: [],
      mappingRowsWithoutPlayerMatch: [],
      duplicateMappedPlayers: [],
      unknownTeamCodes: [],
      duplicateTeamCodes: [],
      warnings: [],
    },
  } as unknown as GameState;
}

describe("Rücknahme der Zwangs-Notkredite", () => {
  it("stellt Cash, Kredit und Origination-Log exakt so her wie vor der Aufnahme", () => {
    const gameState = createGameState({
      teams: [createTeam("M-M", 0)],
      loans: [notkredit("M-M", 27.6)],
    });

    const plan = planeNotkreditRuecknahme(gameState);
    const nachher = plan.gameStateRepariert!;

    // Alle drei Dinge, die `originateLoan` anfasst — und kein viertes.
    expect(nachher.teams.find((team) => team.teamId === "M-M")?.cash).toBeCloseTo(-27.6, 2);
    expect(nachher.seasonState.loans ?? []).toHaveLength(0);
    expect(nachher.seasonState.loanOriginationLogs ?? []).toHaveLength(0);
  });

  it("lässt einen freiwillig aufgenommenen Bank-Kredit unangetastet", () => {
    // Zombie Horde am echten Abbild: Bank, aber Laufzeit 2 und Restschuld 43,0 über der Aufnahme
    // von 36,0 — Zinsen sind kapitalisiert, der Kredit ist gelaufen. Kein Zwangs-Notkredit.
    const freiwillig = {
      ...notkredit("Z-H", 36),
      loanId: "loan:season-2:Z-H:freiwillig",
      termSeasons: 2,
      seasonsRemaining: 2,
      principalOutstanding: 43,
    } as LoanRecord;

    const gameState = createGameState({ teams: [createTeam("Z-H", 8)], loans: [freiwillig] });
    const plan = planeNotkreditRuecknahme(gameState);

    expect(plan.zeilen).toEqual([]);
    expect(plan.gameStateRepariert).toBeNull();
    expect(plan.behalten).toEqual([
      { teamId: "Z-H", loanId: "loan:season-2:Z-H:freiwillig", grund: "Laufzeit 2 statt 4" },
    ]);
  });

  it("rührt einen Notkredit nicht an, sobald schon eine Rate darauf gezahlt wurde", () => {
    // Sobald eine Rate lief, ist der Zustand von vorher nicht mehr durch Abziehen herstellbar —
    // dann wäre die Rücknahme eine Schätzung, und Schätzungen gehören nicht in eine Reparatur.
    const angezahlt = { ...notkredit("D-P", 21.7), seasonsRemaining: 3, principalOutstanding: 18.2 } as LoanRecord;
    const plan = planeNotkreditRuecknahme(createGameState({ teams: [createTeam("D-P", 0)], loans: [angezahlt] }));

    expect(plan.zeilen).toEqual([]);
    expect(plan.behalten[0]?.grund).toBe("bereits 1 Rate(n) gezahlt");
  });

  it("nimmt die neun echten Notkredite aus Chris' Spielstand über zusammen 164,2 zurück", () => {
    const echte: Array<[string, number]> = [
      ["L-K", 31.2],
      ["M-M", 27.6],
      ["D-P", 21.7],
      ["T-T", 20.5],
      ["H-R", 18.4],
      ["R-C", 16.7],
      ["P-C", 16.6],
      ["W-L", 6.8],
      ["V-V", 4.7],
    ];
    const gameState = createGameState({
      teams: [...echte.map(([teamId]) => createTeam(teamId, 0)), createTeam("A-A", 16.7)],
      loans: echte.map(([teamId, principal]) => notkredit(teamId, principal)),
    });

    const plan = planeNotkreditRuecknahme(gameState);
    const nachher = plan.gameStateRepariert!;

    expect(plan.zeilen).toHaveLength(9);
    expect(plan.summe).toBeCloseTo(164.2, 1);
    // Genau der Zustand, der Chris aufgefallen ist, ist danach weg: niemand mehr auf exakt 0,0.
    expect(nachher.teams.filter((team) => team.cash === 0)).toHaveLength(0);
    expect(nachher.teams.filter((team) => team.cash < 0)).toHaveLength(9);
    // Das solvente Team bleibt unberührt.
    expect(nachher.teams.find((team) => team.teamId === "A-A")?.cash).toBe(16.7);
  });

  it("summiert pro Team, wenn ein Team mehrere Notkredite erwischt hat", () => {
    // Am Abbild ist es je genau einer — die Reparatur darf sich darauf aber nicht verlassen, sonst
    // rechnet sie beim zweiten Kredit gegen einen Cash-Stand, den sie selbst schon verändert hat.
    const gameState = createGameState({
      teams: [createTeam("M-M", 0)],
      loans: [
        { ...notkredit("M-M", 10), loanId: "loan:season-2:M-M:eins" } as LoanRecord,
        { ...notkredit("M-M", 5), loanId: "loan:season-2:M-M:zwei" } as LoanRecord,
      ],
    });

    const plan = planeNotkreditRuecknahme(gameState);

    expect(plan.gameStateRepariert!.teams.find((team) => team.teamId === "M-M")?.cash).toBeCloseTo(-15, 2);
    expect(plan.zeilen.every((zeile) => zeile.cashNachher === -15)).toBe(true);
  });

  it("meldet einen sauberen Spielstand als „nichts zu tun“", () => {
    const plan = planeNotkreditRuecknahme(createGameState({ teams: [createTeam("A-A", 42)], loans: [] }));

    expect(plan.zeilen).toEqual([]);
    expect(plan.summe).toBe(0);
    expect(plan.gameStateRepariert).toBeNull();
  });
});
