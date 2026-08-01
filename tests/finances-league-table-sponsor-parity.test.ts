import { describe, expect, it } from "vitest";

import type { GameState, TeamSponsorContract } from "@/lib/data/olyDataTypes";
import { buildFinancesLeagueTable } from "@/lib/foundation/finances/use-finances-league-table";
import { buildFinancesViewModel } from "@/lib/foundation/finances/use-finances-view-model";
import { makePlayer, makeRosterEntry, makeTeam, makeTeamIdentity } from "./_fixtures/game-entity-fixtures";

/**
 * Beide Ansichten (eigene Detail-Übersicht + Liga-Vergleichstabelle) rendern auf DEMSELBEN Finanzen-Screen.
 * Sie müssen für dasselbe Team dieselbe Sponsorsumme zeigen — sonst wirkt es wie ein UI-Rechenfehler.
 *
 * Regressionsschutz für zwei bereits aufgetretene Divergenzen:
 *  1. Die Tabelle nutzte `estimateTeamAnnualRevenue` (fällt in S1 auf die BASIS-Komponente zurück) statt der
 *     Komponentensumme → zeigte z. B. 21,3 statt 74,7.
 *  2. Danach summierte die Tabelle ALLE Komponenten inkl. `overperformance`, deren rewardCash nur ein CAP ist
 *     (Auszahlung = min(cap, Rate × Plätze über Erwartung)) → Tabelle über der Detailansicht.
 */
function buildSponsorContract(teamId: string): TeamSponsorContract {
  return {
    teamId,
    seasonId: "season-1",
    seasonsRemaining: 1,
    name: "Testsponsor",
    payouts: { baseFirstPaid: false, baseSecondPaid: false },
    components: [
      { componentId: "base", kind: "base", label: "Basis", rewardCash: 40 },
      { componentId: "rank", kind: "rank", label: "Rang", rewardCash: 20 },
      { componentId: "improvement", kind: "improvement", label: "Verbesserung", rewardCash: 10 },
      { componentId: "special", kind: "special", label: "Sonderziel", rewardCash: 5 },
      // Reiner CAP — darf in KEINER der beiden Ansichten als sichere Einnahme zählen.
      {
        componentId: "overperformance",
        kind: "overperformance",
        label: "Überperformance",
        rewardCash: 99,
        targetValue: 8,
        ratePerUnitC: 12,
      },
    ],
  } as unknown as TeamSponsorContract;
}

function buildGameState(): GameState {
  const team = makeTeam({ teamId: "team-1", shortCode: "T1", name: "Test United", cash: 100, budget: 100 });
  const rival = makeTeam({ teamId: "team-2", shortCode: "T2", name: "Rival City", cash: 80, budget: 100 });
  const player = makePlayer({ id: "player-1", name: "Star One", salaryDemand: 10 });
  const roster = makeRosterEntry({ id: "r1", teamId: "team-1", playerId: "player-1", salary: 10 });

  return {
    season: { id: "season-1", name: "Season 1", year: 1, currentMatchday: 1, matchdayIds: ["md-1"] },
    matchdayState: { matchdayId: "md-1" },
    teams: [team, rival],
    teamIdentities: [makeTeamIdentity({ teamId: "team-1" }), makeTeamIdentity({ teamId: "team-2" })],
    teamStrategyProfiles: [],
    players: [player],
    rosters: [roster],
    disciplines: [],
    transferHistory: [],
    playerProgressionEvents: [],
    seasonState: {
      seasonId: "season-1",
      loans: [],
      standings: {
        "team-1": { teamId: "team-1", points: 10, rank: 1 },
        "team-2": { teamId: "team-2", points: 8, rank: 2 },
      },
      matchdayResults: [],
      disciplineResults: [],
      playerDisciplinePerformances: [],
      formCards: [],
      facilityEvents: [],
      seasonSnapshots: [],
      sponsorContractsByTeamId: {
        "team-1": buildSponsorContract("team-1"),
      },
    },
  } as unknown as GameState;
}

describe("finances: league table ↔ detail view sponsor parity", () => {
  it("shows the SAME sponsor total in both views, excluding the overperformance cap", () => {
    const gameState = buildGameState();

    const model = buildFinancesViewModel(gameState, "team-1");
    if (model.status !== "ready") throw new Error("expected ready");
    const detailSponsorTotal = model.team.income.sponsor?.total ?? 0;

    const leagueRow = buildFinancesLeagueTable(gameState).find((row) => row.teamId === "team-1");
    if (!leagueRow) throw new Error("expected a league row for team-1");

    // Maßgeblich ist die ECHTE Settlement-Auszahlung, nicht die Summe der Vertrags-Obergrenzen:
    // `component.rewardCash` ist laut sponsor-offer-service nur ein Cap.
    //
    // Seit V3 rechnet das Settlement NICHT mehr aus den Vertrags-Komponenten, sondern aus der
    // eingefrorenen Rang-Leiter; ein Vertrag ohne V3-Terme wird beim Abrechnen migriert
    // (`buildMigratedSponsorV3Terms`). Diese Fixture hat zwei Teams ohne Kader — die Leiter faellt
    // damit auf die Untergrenze `SPONSOR_V3_FLOOR_C`. Das ist korrektes Verhalten fuer eine
    // Fixture ohne Gehaelter, kein Defekt: die Leiter ist gehaltsverankert und hat hier nichts,
    // woran sie sich verankern koennte.
    //
    // Die AUSSAGE dieses Tests ist ohnehin die Parität der beiden Ansichten (Zusicherung unten),
    // nicht der Absolutwert. Der frühere Wert 69,3 stammte aus der Komponenten-Summe von V2.
    expect(detailSponsorTotal).toBeCloseTo(32, 1);
    // Gegenprobe zum ursprünglichen Regressionsgrund: der 99er Überperformance-CAP darf in KEINER
    // Ansicht mitgezählt werden (er zahlte im Settlement 84 — läge er drin, wäre die Summe > 150).
    expect(detailSponsorTotal).toBeLessThan(100);

    // Die Tabelle weist Sponsor + Gebäude-Einnahmen aus; ohne Gebäude ist das exakt die Sponsorsumme.
    expect(leagueRow.incomeAnnual).toBe(detailSponsorTotal);
  });

  it("carries logo data for every team so the comparison table can render crests", () => {
    const rows = buildFinancesLeagueTable(buildGameState());
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.logoInitials.length).toBeGreaterThan(0);
      expect(row).toHaveProperty("logoUrl");
    }
  });
});
