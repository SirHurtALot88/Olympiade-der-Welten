/**
 * CHRIS (wörtlich): „auf der finanzseite bitte erst den liga team vergleich und das apron thema
 * als eigenen reiter!"
 *
 * Beides sind Aussagen über die ANORDNUNG der Finanzen-Seite:
 *   1. Der Liga-Vergleich steht ganz oben (er war vorher die LETZTE Karte).
 *   2. Der Apron läuft nicht mehr in der Hauptansicht mit, sondern hat einen eigenen Reiter.
 *
 * Geprüft wird beides an der WIRKUNG, nicht am Quelltext: die Reiter werden wirklich gerendert
 * (`renderToStaticMarkup`) und im Ergebnis wird die Reihenfolge der Karten gelesen. Ein
 * Zeichenketten-Test auf die .tsx-Datei würde hier nichts aussagen — er bliebe grün, wenn jemand
 * die Karten anders verschachtelt, und rot, wenn sich nur ein Kommentar ändert.
 *
 * Dazu die Reihenfolge-Daten selbst (`finances-view-sections.ts`): sie sind die EINE Quelle, aus
 * der die Ansicht ihre Blöcke abarbeitet — steht dort der Liga-Vergleich vorn, steht er auch im
 * Markup vorn (genau das prüft der Render-Teil gegen).
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import FoundationFinancesNewLook, {
  FinancesApronTab,
  FinancesUebersichtTab,
} from "@/app/foundation/finances/FoundationFinancesNewLook";
import type { GameState } from "@/lib/data/olyDataTypes";
import { buildFinancesLeagueTable } from "@/lib/foundation/finances/use-finances-league-table";
import {
  FINANCES_APRON_BLOCK_ORDER,
  FINANCES_DEFAULT_TAB,
  FINANCES_OVERVIEW_BLOCK_ORDER,
  FINANCES_TABS,
} from "@/lib/foundation/finances/finances-view-sections";
import { buildFinancesViewModel } from "@/lib/foundation/finances/use-finances-view-model";
import { makePlayer, makeRosterEntry, makeTeam, makeTeamIdentity } from "./_fixtures/game-entity-fixtures";

/** Season-2-Spielstand mit eigenem Team, echten Gehältern und einem laufenden Kredit. */
function buildGameState(): GameState {
  const team = makeTeam({ teamId: "team-1", shortCode: "T1", name: "Test United", cash: 50, budget: 100 });
  const rival = makeTeam({ teamId: "team-2", shortCode: "T2", name: "Rival City", cash: 80, budget: 100 });
  const star = makePlayer({ id: "player-1", name: "Star One", salaryDemand: 30 });
  const bench = makePlayer({ id: "player-2", name: "Bench Two", salaryDemand: 4 });

  return {
    season: { id: "season-2", name: "Season 2", year: 2, currentMatchday: 1, matchdayIds: ["md-1"] },
    matchdayState: { matchdayId: "md-1" },
    teams: [team, rival],
    teamIdentities: [makeTeamIdentity({ teamId: "team-1" }), makeTeamIdentity({ teamId: "team-2" })],
    teamStrategyProfiles: [],
    players: [star, bench],
    rosters: [
      makeRosterEntry({ id: "r1", teamId: "team-1", playerId: "player-1", salary: 24 }),
      makeRosterEntry({ id: "r2", teamId: "team-2", playerId: "player-2", salary: 4 }),
    ],
    disciplines: [],
    transferHistory: [],
    playerProgressionEvents: [],
    seasonState: {
      seasonId: "season-2",
      loans: [
        {
          loanId: "loan-1",
          borrowerTeamId: "team-1",
          lenderType: "bank",
          principalOriginal: 30,
          principalOutstanding: 22.4,
          interestRatePerSeason: 0.14,
          termSeasons: 4,
          seasonsRemaining: 3,
          installmentPerSeason: 10.3,
          originatedSeasonId: "season-1",
          status: "active",
          missedPayments: 0,
        },
      ],
      standings: {
        "team-1": { teamId: "team-1", points: 20, rank: 1 },
        "team-2": { teamId: "team-2", points: 10, rank: 2 },
      },
      matchdayResults: [],
      disciplineResults: [],
      playerDisciplinePerformances: [],
      formCards: [],
      facilityEvents: [],
      teamFacilities: {},
      seasonSnapshots: undefined,
    },
  } as unknown as GameState;
}

const gameState = buildGameState();
const model = buildFinancesViewModel(gameState, "team-1");
if (model.status !== "ready") throw new Error("View-Model nicht ready — Fixture kaputt");
const team = model.team;
const leagueTable = buildFinancesLeagueTable(gameState);

/** Position eines Markers im gerenderten HTML; −1 bedeutet „kommt nicht vor". */
function position(markup: string, testId: string): number {
  return markup.indexOf(`data-testid="${testId}"`);
}

const uebersicht = renderToStaticMarkup(
  <FinancesUebersichtTab
    team={team}
    incomeLines={[]}
    expenseLines={[]}
    leagueTable={leagueTable}
    activeManagerTeamId="team-1"
    onOpenTeam={null}
  />,
);
const apron = renderToStaticMarkup(<FinancesApronTab team={team} />);
const ganzeSeite = renderToStaticMarkup(
  <FoundationFinancesNewLook
    teamName="Test United"
    model={model}
    leagueTable={leagueTable}
    activeManagerTeamId="team-1"
    salaryFactorOutlook={{ currentFactor: 1.1, nextFactor: 1.2, delta: 0.1, direction: "up" }}
  />,
);

describe("Finanzen · der Liga-Team-Vergleich steht zuerst", () => {
  it("die Übersicht rendert ihn VOR allen anderen Karten", () => {
    const liga = position(uebersicht, "nl-fin-league-card");
    expect(liga).toBeGreaterThanOrEqual(0);
    for (const spaeter of [
      "nl-fin-flow-card",
      "nl-fin-commitments-card",
      "nl-fin-reconciliation-card",
      "nl-fin-history-card",
      "nl-fin-income-card",
      "nl-fin-expense-card",
    ]) {
      const stelle = position(uebersicht, spaeter);
      expect(stelle, `${spaeter} fehlt in der Übersicht`).toBeGreaterThanOrEqual(0);
      expect(liga, `${spaeter} steht vor dem Liga-Vergleich`).toBeLessThan(stelle);
    }
  });

  it("auch auf der ganzen Seite kommt keine dieser Karten vor ihm", () => {
    const liga = position(ganzeSeite, "nl-fin-league-card");
    expect(liga).toBeGreaterThanOrEqual(0);
    expect(liga).toBeLessThan(position(ganzeSeite, "nl-fin-flow-card"));
    expect(liga).toBeLessThan(position(ganzeSeite, "nl-fin-commitments-card"));
  });

  it("und er trägt weiterhin jede Team-Zeile der Liga", () => {
    expect(leagueTable.length).toBe(gameState.teams.length);
    for (const zeile of leagueTable) {
      expect(uebersicht).toContain(zeile.teamCode);
    }
  });
});

describe("Finanzen · der Apron hat einen eigenen Reiter", () => {
  it("die Reiter-Leiste bietet Übersicht und Apron an", () => {
    expect(FINANCES_TABS.map((tab) => tab.id)).toEqual(["uebersicht", "apron"]);
    expect(ganzeSeite).toContain('aria-label="Finanz-Bereiche"');
    for (const tab of FINANCES_TABS) {
      expect(ganzeSeite).toContain(tab.label);
    }
  });

  it("die Seite geht mit der Übersicht auf — Apron-Inhalte sind dort NICHT mit drin", () => {
    expect(FINANCES_DEFAULT_TAB).toBe("uebersicht");
    for (const apronMarker of [
      "nl-fin-apron",
      "nl-fin-apron-card",
      "nl-fin-apron-meter",
      "nl-fin-apron-projection",
      "nl-fin-apron-league-block",
      "nl-fin-apron-lg-table",
    ]) {
      expect(position(ganzeSeite, apronMarker), `${apronMarker} läuft noch in der Hauptansicht mit`).toBe(-1);
      expect(position(uebersicht, apronMarker), `${apronMarker} läuft noch im Übersicht-Reiter mit`).toBe(-1);
    }
  });

  it("der Apron-Reiter zeigt beide Apron-Blöcke — Linien zuerst, dann der Liga-Ausweis", () => {
    expect([...FINANCES_APRON_BLOCK_ORDER]).toEqual(["apron-linien", "apron-liga"]);
    const linien = position(apron, "nl-fin-apron-card");
    const ligaAusweis = position(apron, "nl-fin-apron-league-card");
    expect(linien).toBeGreaterThanOrEqual(0);
    expect(ligaAusweis).toBeGreaterThan(linien);
    expect(position(apron, "nl-fin-apron-meter")).toBeGreaterThanOrEqual(0);
    expect(position(apron, "nl-fin-apron-lg-table")).toBeGreaterThanOrEqual(0);
  });

  it("er zeigt dieselben Apron-Zahlen wie das View-Model (nichts neu gerechnet)", () => {
    const werte = team.apron!;
    // Anzeige-Format der Karte (formatNlMoney) — deutsches Komma, eine Nachkommastelle.
    const geld = (value: number) => value.toFixed(1).replace(".", ",");
    expect(apron).toContain(geld(werte.line1));
    expect(apron).toContain(geld(werte.line2));
    expect(apron).toContain(geld(werte.salaryBasis));
    // Jede Liga-Zeile der Projektion taucht im Ausweis auf.
    for (const zeile of werte.league) {
      expect(apron).toContain(zeile.teamCode);
    }
  });

  it("der Apron-Reiter enthält umgekehrt keine Übersicht-Karten", () => {
    for (const uebersichtMarker of [
      "nl-fin-league-card",
      "nl-fin-flow-card",
      "nl-fin-commitments-card",
      "nl-fin-history-card",
    ]) {
      expect(position(apron, uebersichtMarker), `${uebersichtMarker} steht im Apron-Reiter`).toBe(-1);
    }
  });
});

describe("Finanzen · die Reihenfolge steht an genau einer Stelle", () => {
  it("die Übersicht führt mit dem Liga-Vergleich und kennt keinen Apron-Block", () => {
    expect(FINANCES_OVERVIEW_BLOCK_ORDER[0]).toBe("liga-vergleich");
    expect(FINANCES_OVERVIEW_BLOCK_ORDER.filter((block) => block.startsWith("apron"))).toEqual([]);
  });

  it("jede Block-Id kommt genau einmal vor (keine Karte doppelt, keine verloren)", () => {
    const alle = [...FINANCES_OVERVIEW_BLOCK_ORDER, ...FINANCES_APRON_BLOCK_ORDER];
    expect(new Set(alle).size).toBe(alle.length);
  });
});
