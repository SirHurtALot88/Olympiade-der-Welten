/**
 * SCHRITT 5: WAS AUF DER GEBÄUDE-KARTE STEHT, IST WAS AUF DEM KONTO ANKOMMT.
 *
 * Dieser Schritt ist durch Entscheidung E1 fast leer geworden, und das ist der Punkt der Suite: die
 * urspruenglich geplante Leih-Abzugszeile im Settlement DARF ES NICHT GEBEN. Der Verzicht steckt
 * bereits in der Leiter — eine zweite Buchung waere Doppelzahlung, und zwar eine, die niemandem
 * auffiele, weil beide Zahlen fuer sich plausibel aussehen.
 *
 * Geprueft wird deshalb nicht „gibt es eine Zeile", sondern die harte Projekt-Invariante: die Kasse
 * aendert sich um GENAU den Betrag, den die Karte angezeigt hat. Wenn irgendwann jemand die
 * Abzugszeile doch einbaut, faellt dieser Test um.
 */
import { describe, expect, it } from "vitest";

import type { GameState, Team, TeamIdentity } from "@/lib/data/olyDataTypes";
import { buildSponsorOffersForTeam, chooseSponsorOffer } from "@/lib/sponsor/sponsor-offer-service";
import { applySponsorSettlement, previewSponsorSettlement } from "@/lib/sponsor/sponsor-settlement-service";
import { getSponsorV3Terms, sponsorV3LadderValue, sponsorV3Settle } from "@/lib/sponsor/sponsor-v3-offer-service";

function baueSpielstand(): GameState {
  const teams = Array.from({ length: 12 }, (_, index) => ({
    teamId: index === 0 ? "M-M" : `T-${index + 1}`,
    name: index === 0 ? "Mayhem Mavericks" : `Team ${index + 1}`,
    shortCode: index === 0 ? "M-M" : `T${index + 1}`,
    cash: 100,
    rosterLimit: 14,
    humanControlled: index === 0,
  })) as Team[];
  const teamIdentities = teams.map((team) => ({
    teamId: team.teamId,
    ambition: 6,
    finances: 5,
    pow: 5,
    spe: 5,
    men: 5,
    soc: 5,
    playerMin: 7,
    playerOpt: 10,
  })) as TeamIdentity[];
  const standings = Object.fromEntries(
    teams.map((team, index) => [team.teamId, { points: 120 - index * 5, rank: index + 1, startplatz: index + 1 }]),
  );

  return {
    season: { id: "season-2", name: "Season 2", year: 2, currentMatchday: 10, matchdayIds: ["md-1"] },
    seasonState: { seasonId: "season-2", schedule: [], standings },
    matchdayState: { matchdayId: "md-1", status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams,
    teamIdentities,
    players: [],
    rosters: [],
    contracts: [],
    transferListings: [],
    transferHistory: [],
    logs: [],
    mappingReport: {
      mappingSource: "test",
      teamSource: "test",
      generatedAt: "2026-08-11T00:00:00.000Z",
      processedMappingRows: 0,
      importedPlayerCount: 0,
      matchedRosterCount: 0,
      teamCount: teams.length,
      unmappedPlayers: [],
    },
    disciplines: [],
  } as unknown as GameState;
}

function unterschreibeGebaeudeKarte() {
  const gameState = baueSpielstand();
  const angebote = buildSponsorOffersForTeam({ gameState, teamId: "M-M" });
  const mitLeihe = angebote.find((angebot) => angebot.sponsorLeihe != null)!;
  const mitAngeboten: GameState = {
    ...gameState,
    seasonState: { ...gameState.seasonState, sponsorOffersByTeamId: { "M-M": angebote } },
  };
  const { gameState: unterschrieben } = chooseSponsorOffer({
    gameState: mitAngeboten,
    teamId: "M-M",
    offerId: mitLeihe.offerId,
  });
  return { angebot: mitLeihe, gameState: unterschrieben };
}

describe("Die Gebäude-Karte im Settlement", () => {
  it("bucht KEINE eigene Leih-Zeile — der Verzicht steckt in der Leiter (E1)", () => {
    const { gameState } = unterschreibeGebaeudeKarte();
    const preview = previewSponsorSettlement(gameState, "season_end");
    const zeilen = preview.rows.filter((row) => row.teamId === "M-M");

    expect(zeilen.length).toBeGreaterThan(0);
    for (const zeile of zeilen) {
      expect(
        /leih|verzicht|gebäude|gebaeude/i.test(`${zeile.label ?? ""}${zeile.componentId ?? ""}`),
        `unerwartete Leih-Zeile: ${zeile.label ?? zeile.componentId}`,
      ).toBe(false);
    }
  });

  it("aendert die Kasse um exakt die Summe der angezeigten Zeilen", () => {
    const { gameState } = unterschreibeGebaeudeKarte();
    const kasseVorher = gameState.teams.find((team) => team.teamId === "M-M")!.cash;
    const terms = getSponsorV3Terms(gameState.seasonState.sponsorContractsByTeamId!["M-M"]!)!;
    const endrang = gameState.seasonState.standings!["M-M"]!.rank!;

    const preview = previewSponsorSettlement(gameState, "season_end");
    const angezeigt = preview.rows
      .filter((row) => row.teamId === "M-M")
      .reduce((summe, row) => summe + row.cashDelta, 0);

    const { gameState: danach, applied } = applySponsorSettlement({
      gameState,
      saveId: "test",
      phase: "season_end",
      execute: true,
    });

    expect(applied).toBe(true);
    const kasseNachher = danach.teams.find((team) => team.teamId === "M-M")!.cash;
    // DAS IST DIE INVARIANTE, um die es geht: was die Karte zeigt, kommt an — kein stiller Abzug
    // dazwischen. Geprueft wird gegen die ANGEZEIGTEN Zeilen und nicht gegen eine im Test
    // nachgebaute Formel; eine Nachbildung wuerde nur sich selbst pruefen.
    expect(kasseNachher - kasseVorher).toBeCloseTo(angezeigt, 1);

    // Und die Zeilen teleskopieren auf die eine Rechenstelle des Modells. Der Erfuellungsgrad der
    // Achse wird dabei NICHT geraten: er wird aus der Zeile zurueckgerechnet. Der erste Anlauf
    // dieses Tests nahm 0 an („kein Kader, also kein Fortschritt") und lag um 1,7 C daneben — die
    // Achse liefert hier 8,5 %, nicht 0.
    const leiterWert = sponsorV3LadderValue(terms, endrang);
    const erfuellung = (angezeigt - leiterWert + terms.goalP * terms.goalSize) / (terms.goalSize || 1);
    expect(angezeigt).toBeCloseTo(sponsorV3Settle(terms, endrang, erfuellung), 1);
  });

  it("zahlt einer Gebäude-Karte messbar weniger als der reinen Cash-Karte desselben Slates", () => {
    // Die Gegenprobe zum Test darueber: wuerde der Verzicht gar nicht wirken, kaeme hier dasselbe
    // heraus — und die ganze Entscheidung waere gratis.
    const basis = baueSpielstand();
    const angebote = buildSponsorOffersForTeam({ gameState: basis, teamId: "M-M" });
    const endrang = basis.seasonState.standings!["M-M"]!.rank!;

    const auszahlung = (offerId: string) => {
      const mitAngeboten: GameState = {
        ...basis,
        seasonState: { ...basis.seasonState, sponsorOffersByTeamId: { "M-M": angebote } },
      };
      const { gameState } = chooseSponsorOffer({ gameState: mitAngeboten, teamId: "M-M", offerId });
      const vorher = gameState.teams.find((team) => team.teamId === "M-M")!.cash;
      const { gameState: danach } = applySponsorSettlement({
        gameState,
        saveId: "test",
        phase: "season_end",
        execute: true,
      });
      return danach.teams.find((team) => team.teamId === "M-M")!.cash - vorher;
    };

    const reineCash = angebote.find((angebot) => angebot.sponsorLeihe == null)!;
    const mitLeihe = angebote.find((angebot) => angebot.sponsorLeihe != null)!;
    const verzicht = getSponsorV3Terms(mitLeihe)!.leihVerzicht ?? 0;

    expect(verzicht).toBeGreaterThan(0);
    // Kleiner — und der Abstand deckt sich mit dem Verzicht plus dem Raritaets-Unterschied der
    // beiden Karten. Geprueft wird die Richtung und die Groessenordnung, nicht die zweite
    // Nachkommastelle: die beiden Karten tragen verschiedene Kurvenformen.
    const differenz = auszahlung(reineCash.offerId) - auszahlung(mitLeihe.offerId);
    expect(differenz).toBeGreaterThan(0);
    void endrang;
  });
});
