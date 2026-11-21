/**
 * Finanzseite (18.11., Finanzkonzept V2, Vorlage `public/mockups/finanzen-modern-18-11.html`).
 *
 * Geprueft wird an der WIRKUNG: die Seite wird wirklich gerendert (`renderToStaticMarkup`) und im Ergebnis wird gelesen.
 *  - jeder Reiter geht mit seinem Inhalt auf, nichts vom alten Stil (`nl-fin`) ist uebrig
 *  - die zwei Toepfe, Umschichten, Lockerung, Vorstand, „Alles auf eine Karte“ stehen auf der Budget-Ansicht
 *  - Gehaelter gross je Saison und klein je Spieltag, Einheit C
 *  - der Liga-Vergleich und der Apron haben ihren Platz (Chris: „liga team vergleich und das apron thema als eigenen reiter“)
 *  - Mehrspieler: die Seite liest das aktive Team, nie ein festes; ohne Verwaltungsrecht sind alle Regler gesperrt
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import FinanzenModern, { type FinanzenAnsicht, type FinanzenKontextReiter } from "@/app/foundation/finances/FinanzenModern";
import type { GameState } from "@/lib/data/olyDataTypes";
import { buildFinancesLeagueTable } from "@/lib/foundation/finances/use-finances-league-table";
import { buildFinancesViewModel } from "@/lib/foundation/finances/use-finances-view-model";
import { makePlayer, makeRosterEntry, makeTeam, makeTeamIdentity } from "./_fixtures/game-entity-fixtures";

function buildGameState(): GameState {
  const team = makeTeam({ teamId: "team-1", shortCode: "T1", name: "Test United", cash: 50, budget: 100 });
  const rival = makeTeam({ teamId: "team-2", shortCode: "T2", name: "Rival City", cash: 80, budget: 100 });
  const star = makePlayer({ id: "player-1", name: "Star One", salaryDemand: 30 });
  const bench = makePlayer({ id: "player-2", name: "Bench Two", salaryDemand: 4 });
  return {
    season: { id: "season-2", name: "Season 2", year: 2, currentMatchday: 1, matchdayIds: ["md-1"], totalMatchdays: 20 },
    gamePhase: "season_active",
    matchdayState: { matchdayId: "md-1", status: "open" },
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
      boardConfidence: { "team-1": { teamId: "team-1", value: 5, pressure: 5, warnings: [] } },
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
      standings: { "team-1": { teamId: "team-1", points: 20, rank: 1 }, "team-2": { teamId: "team-2", points: 10, rank: 2 } },
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
const leagueTable = buildFinancesLeagueTable(gameState);
const salaryFactorOutlook = { currentFactor: 1.1, nextFactor: 1.2, delta: 0.1, direction: "up" as const };

function seite(ansicht: FinanzenAnsicht, extra: Partial<{ kontext: FinanzenKontextReiter; kannVerwalten: boolean; teamId: string | null }> = {}) {
  return renderToStaticMarkup(
    <FinanzenModern
      gameState={gameState}
      teamId={extra.teamId === undefined ? "team-1" : extra.teamId}
      finanzen={model}
      leagueTable={leagueTable}
      salaryFactorOutlook={salaryFactorOutlook}
      onVorstandAktion={async () => ({ ok: true, reason: null, meldung: "" })}
      kannVerwalten={extra.kannVerwalten ?? true}
      startAnsicht={ansicht}
      startKontext={extra.kontext ?? "lage"}
    />,
  );
}

describe("Finanzen · neue Seite, nichts vom alten Stil", () => {
  it("geht mit der Uebersicht auf: Kassenverlauf, Kennzahlen, Lage rechts", () => {
    const html = seite("uebersicht");
    expect(html).toContain('data-testid="finanzen-modern"');
    expect(html).toContain('data-testid="fin-kassenverlauf"');
    expect(html).toContain('data-testid="fin-lage"');
    expect(html).toContain("Kasse jetzt");
    expect(html).not.toContain("nl-fin");
    expect(html).not.toContain("nl-card");
  });

  it("zeigt Gehaelter gross je Saison und klein je Spieltag, Einheit C", () => {
    const html = seite("uebersicht");
    // 24 C Gehalt, 20 Spieltage -> 1,20 C je Spieltag
    expect(html).toContain("24,00 C je Saison");
    expect(html).toContain("1,20 C je Spieltag");
  });

  it("jede der sechs Ansichten rendert ihren Inhalt", () => {
    expect(seite("kontoauszug")).toContain('data-testid="fin-kontoauszug"');
    expect(seite("budgets")).toContain('data-testid="fin-budgets"');
    expect(seite("sponsor")).toMatch(/fin-sponsor|Kein Sponsor-Vertrag/);
    expect(seite("guv")).toContain('data-testid="fin-guv"');
    expect(seite("apron")).toMatch(/fin-apron|nicht berechenbar/);
  });
});

describe("Finanzen · Budgets nach dem Mockup", () => {
  const html = seite("budgets");
  it("die zwei Toepfe mit Herleitung", () => {
    expect(html).toContain("Transfer- und Investitionsbudget");
    expect(html).toContain("Gehaltsbudget");
    expect(html).toContain("Kasse zu Fensterbeginn");
    expect(html).toContain("Rücklage-Ziel");
    expect(html).toContain("tragbares Gehalt");
  });
  it("Umschichten, Vorstand, Sonderwege, was gegen welchen Topf zaehlt (Lockerung nur im alten Ablauf)", () => {
    expect(html).toContain("Umschichten");
    expect(html).not.toContain("Lockerung nach Verkäufen");
    const vorher = process.env.OLY_TRANSFERFENSTER_GEMEINSAM;
    process.env.OLY_TRANSFERFENSTER_GEMEINSAM = "0";
    try {
      expect(seite("budgets")).toContain("Lockerung nach Verkäufen");
    } finally {
      if (vorher === undefined) delete process.env.OLY_TRANSFERFENSTER_GEMEINSAM;
      else process.env.OLY_TRANSFERFENSTER_GEMEINSAM = vorher;
    }
    expect(html).toContain("von 10 Vertrauen");
    // Office 21.11: Rücklage anzapfen und „Alles auf eine Karte“ laufen nur noch im Vorstandsgespräch; hier steht der Weg dorthin.
    expect(html).not.toContain("Rücklage anzapfen");
    expect(html).toContain("Alles auf eine Karte");
    expect(html).toContain("Mit dem Vorstand sprechen");
    expect(html).toContain('data-testid="fin-zum-gespraech"');
    expect(html).not.toMatch(/>Beantragen<\/button>/);
    expect(html).toContain("Pflichtkader (8 Spieler)");
    expect(html).toContain("Gebäude bauen");
  });
  it("Gehaltsbudget nennt Saison und Spieltag", () => {
    expect(html).toMatch(/je Saison[^<]*· Budget [\d,.]+ · [\d,.]+ je Spieltag/);
  });
  it("ohne Verwaltungsrecht sind Regler und Knoepfe gesperrt (Mehrspieler: kein Schreiben ins fremde Team)", () => {
    const gesperrt = seite("budgets", { kannVerwalten: false });
    // Nur noch der Umschicht-Regler liegt auf dieser Seite; Anzapfen und „Alles auf eine Karte“ sind ins Gespräch gewandert.
    expect(gesperrt.match(/class="fin-regler"[^>]*disabled/g)?.length ?? 0).toBeGreaterThanOrEqual(1);
  });
});

describe("Finanzen · Liga-Vergleich und Apron haben ihren Platz", () => {
  it("der Liga-Vergleich traegt jedes Team der Liga und markiert das eigene", () => {
    const html = seite("uebersicht", { kontext: "liga" });
    expect(html).toContain('data-testid="fin-liga"');
    expect(html).toContain("Test United");
    expect(html).toContain("Rival City");
    expect(html).toContain("Dein Team");
  });
  it("der Apron ist ein eigener Reiter", () => {
    const html = seite("uebersicht");
    expect(html).toContain(">Apron</button>");
  });
});

describe("Finanzen · Mehrspieler", () => {
  it("ohne aktives Team sagt die Seite es, statt ein fremdes zu zeigen", () => {
    const html = seite("uebersicht", { teamId: null });
    expect(html).toContain("Kein Team gewählt");
    expect(html).not.toContain("Test United");
  });
  it("zeigt das Team des aktiven Managers, nicht das erste der Liste", () => {
    const html = renderToStaticMarkup(
      <FinanzenModern
        gameState={gameState}
        teamId="team-2"
        finanzen={buildFinancesViewModel(gameState, "team-2")}
        leagueTable={leagueTable}
        salaryFactorOutlook={salaryFactorOutlook}
      />,
    );
    expect(html).toContain("Rival City");
  });
});

describe("Finanzen · Kaderaufbau (Saison 1) und gemeinsames Fenster", () => {
  it("zeigt in Saison 1 die Kaderaufbau-Karte statt einer Transferbilanz", () => {
    const mitAufbau = {
      ...model,
      team: model.team && { ...model.team, kaderaufbau: { net: -80, buyTotal: 80, sellTotal: 0, buyCount: 9, sellCount: 0 } },
    } as typeof model;
    const html = renderToStaticMarkup(
      <FinanzenModern
        gameState={gameState}
        teamId="team-1"
        finanzen={mitAufbau}
        leagueTable={leagueTable}
        salaryFactorOutlook={salaryFactorOutlook}
        onVorstandAktion={async () => ({ ok: true, reason: null, meldung: "" })}
        kannVerwalten
        startAnsicht="uebersicht"
        startKontext="lage"
      />,
    );
    expect(html).toContain('data-testid="fin-kaderaufbau"');
    expect(html).toContain("Kaderaufbau aus dem Startbudget");
    expect(html).toContain("Transferbilanz");
  });

  it("im gemeinsamen Fenster gibt es keine Lockerungs-Karte (Verkaufserloese zu 100 % frei)", () => {
    expect(seite("budgets")).not.toContain("Lockerung nach Verkäufen");
  });
});
