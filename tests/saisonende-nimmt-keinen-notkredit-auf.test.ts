/**
 * DAS SAISONENDE NIMMT KEINEN KREDIT MEHR AUF.
 *
 * Chris hatte nach der Abrechnung von Saison 2 gemeldet: „viele teams haben plötzlich 0 […] es kann
 * ja nicht sein dass die halbe liga plötzlich genau 0 hat." Die Ursache war der Insolvenz-Backstop
 * am Ende der Saisonabrechnung: jedes Team im Minus bekam ungefragt einen Bank-Kredit über exakt den
 * Fehlbetrag, Cash danach 0,0. Auf dem gespielten Stand traf das 9 von 32 Teams, zusammen 164,2 Mio
 * Kreditsumme, die niemand beantragt hatte.
 *
 * Seine Regel dazu, in zwei Sätzen: „teams können auch ins negative gehen und müssen das dann mit
 * verkäufen und krediten wieder auffüllen" — und der Zeitpunkt: „den kredit sollen sie ja erst
 * aufnehmen wenn sie schon verkauft haben […] aber nicht am ende einer season!"
 *
 * `applySeasonEndTail` ist der EINE Ort, an dem beide Abrechnungswege (Cockpit „Saison abschliessen"
 * und der Knopf „Sponsoren buchen") diesen Schwanz durchlaufen. Wenn er hier keinen Kredit mehr
 * aufnimmt, tut es keiner der beiden Wege. Der Ausgleich am Ende des KAUFFENSTERS bleibt davon
 * unberührt — der wird in `tests/loan-service.test.ts` (`applyInsolvencyBackstop`) geprüft.
 */

import { describe, expect, it } from "vitest";

import type { GameState, Team, TeamIdentity } from "@/lib/data/olyDataTypes";
import { applySeasonEndTail } from "@/lib/season/season-end-tail-settlement";

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

function createIdentity(teamId: string): TeamIdentity {
  return {
    teamId,
    playerType: null,
    pow: 8,
    spe: 7,
    men: 5,
    soc: 3,
    ambition: 5,
    finances: 5,
    boardConfidence: 7,
    harmony: 5,
    manners: 5,
    popularity: 5,
    cooperation: 5,
    playerMin: 7,
    playerOpt: 10,
  };
}

function createGameState(teams: Team[]): GameState {
  return {
    season: {
      id: SEASON_ID,
      name: "Season 2",
      year: 2027,
      currentMatchday: 12,
      matchdayIds: ["matchday-1"],
    },
    seasonState: {
      seasonId: SEASON_ID,
      schedule: [],
      standings: Object.fromEntries(teams.map((team) => [team.teamId, { points: 0 }])),
      loans: [],
      loanApplyLogs: [],
      sponsorPayoutLogs: [],
    },
    matchdayState: {
      matchdayId: "matchday-1",
      status: "planning",
      pendingTeamIds: [],
      resolvedFixtureIds: [],
    },
    teams,
    teamIdentities: teams.map((team) => createIdentity(team.teamId)),
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
      teamCount: teams.length,
      unmappedPlayers: [],
      teamsWithoutPlayers: [],
      mappingRowsWithoutPlayerMatch: [],
      duplicateMappedPlayers: [],
      unknownTeamCodes: [],
      duplicateTeamCodes: [],
      warnings: [],
    },
  };
}

function runTail(gameState: GameState) {
  return applySeasonEndTail({ gameState, saveId: "save-1", seasonId: SEASON_ID, execute: true });
}

describe("Saisonende: Zahlungsunfähigkeit wird festgestellt, nicht ausgeglichen", () => {
  it("lässt ein Team im Minus im Minus — kein Kredit, kein Cash aus dem Nichts", () => {
    const result = runTail(createGameState([createTeam("M-M", -27.6)]));

    // Der Stand darf sich durch die regulären Schritte davor (Kreditraten, Vorstandsziele) noch
    // bewegen — aber er darf NICHT bei 0 landen, und es darf kein Kredit dafür entstehen.
    expect(result.gameState.teams.find((team) => team.teamId === "M-M")?.cash).toBeLessThan(0);
    expect(result.gameState.seasonState.loans ?? []).toHaveLength(0);
  });

  it("erzeugt genau NICHT den Zustand, der Chris aufgefallen ist: niemand landet auf exakt 0", () => {
    // Die neun Beträge sind die echten Fehlbeträge aus Chris' Spielstand nach Saison 2 — zusammen
    // 164,2 Mio Kreditsumme, die der alte Backstop ungefragt aufgenommen hat.
    const fehlbetraege = [-31.2, -27.6, -21.7, -20.5, -18.4, -16.7, -16.6, -6.8, -4.7];
    const teams = fehlbetraege.map((cash, index) => createTeam(`T-${index}`, cash));

    const result = runTail(createGameState(teams));

    expect(result.gameState.teams.filter((team) => team.cash === 0)).toHaveLength(0);
    expect(result.gameState.seasonState.loans ?? []).toHaveLength(0);
    expect(result.negativeCashTeams).toHaveLength(9);
  });

  it("nennt als Fehlbetrag den Stand NACH der Abrechnung, nicht den davor", () => {
    // Die Reihenfolge ist der Grund: die Feststellung läuft als LETZTER Schritt, nach Kreditraten
    // und Vorstandszielen. Was sie meldet, ist der Stand, mit dem das Team wirklich in die Pause
    // geht — nicht der, mit dem es in die Abrechnung ging.
    const result = runTail(createGameState([createTeam("M-M", -27.6), createTeam("A-A", 40)]));

    const cashDanach = result.gameState.teams.find((team) => team.teamId === "M-M")?.cash ?? 0;
    const gemeldet = result.negativeCashTeams.find((entry) => entry.teamId === "M-M");
    expect(gemeldet?.shortfall).toBeCloseTo(-cashDanach, 2);
    expect(result.warnings).toContain(`negatives_cash_am_saisonende:M-M:${gemeldet?.shortfall}`);
    expect(result.warnings.filter((warning) => warning.startsWith("negatives_cash_am_saisonende:"))).toHaveLength(1);
  });

  it("meldet nichts, wenn die ganze Liga solvent ist", () => {
    const result = runTail(createGameState([createTeam("A-A", 40), createTeam("B-B", 0.5)]));

    expect(result.negativeCashTeams).toEqual([]);
    expect(result.warnings.filter((warning) => warning.startsWith("negatives_cash_am_saisonende:"))).toEqual([]);
  });
});
