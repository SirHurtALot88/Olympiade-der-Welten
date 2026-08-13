/**
 * GEMELDET VON CHRIS (Portraitkarte in der Teams-Ansicht, MW 41,1 Mio · GEHALT 5,0 Mio ·
 * VK 30,4 Mio −10,7): „der VK ist hier falsch berechnet und stimmt nicht mit dem auf der
 * spieler seite überein!"
 *
 * BEFUND: `FoundationTeamsNewLook.tsx` griff für die VK-Zahl der Portraitkarte auf
 * `ExpectedSellValueEntry.expectedSellValue` (Netto = Brutto − Rest-Buyout) zu. Die
 * "VK-Wert"-Spalte der Spielerliste (`FoundationPlayersTableNewLook.tsx`, siehe
 * `tests/players-table-sell-value-gross.test.ts`) zeigt dagegen `grossSalePrice` (Brutto) —
 * zwei Felder DESSELBEN Eintrags, zwei Zahlen für denselben Spieler zur gleichen Zeit. Chris'
 * eigene Vermutung dazu ("ist der wert also niedriger weil der buyout da mit eingerechnet ist?")
 * trifft die Rechenkette exakt: `buildTransfermarktSaleFactorBreakdown` legt erst den
 * Verkaufsfaktor auf den Marktwert (`lib/market/transfermarkt-sale-factor.ts`), danach zieht
 * `resolveTransfermarktSellProceeds` den Buyout ab (`lib/market/transfermarkt-sell-proceeds.ts`)
 * — genau die Differenz, die die Karte fälschlich als Hauptzahl zeigte.
 *
 * Die Reparatur zieht die Karte auf `grossSalePrice` — DENSELBEN Ableitungsweg wie die
 * Spielerliste (`resolveTeamsPortraitSellValueDisplay`, lib/foundation/teams-portrait-sell-
 * value.ts) statt einer zweiten, eigenen Rechnung. Dieser Test prüft die Definitions-Gleichheit
 * an WERTEN: derselbe Eintrag, dieselbe Zahl, tatsächlich durch die Karten-Komponente gerendert
 * — nicht per Quelltext-Grep.
 */
import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { GameState, Player, RosterEntry, Team } from "@/lib/data/olyDataTypes";
import { buildExpectedSellValueByPlayerId } from "@/lib/market/transfermarkt-expected-sell-value";
import {
  buildTeamsPortraitMwValueText,
  resolveTeamsPortraitSellValueDisplay,
} from "@/lib/foundation/teams-portrait-sell-value";
import FoundationPlayerPortraitCard from "@/components/foundation/player-portrait-card/FoundationPlayerPortraitCard";

// Dieselben Fixture-Helfer wie tests/transfermarkt-expected-sell-value.test.ts — ein minimaler,
// aber vollständiger GameState, der einen Kaderspieler mit offenem Rest-Buyout trägt (Brutto ≠
// Netto), damit der Test überhaupt etwas zu unterscheiden hat.
function createTeam(): Team {
  return {
    teamId: "A-A",
    shortCode: "A-A",
    name: "Armageddon Aftermath",
    budget: 175,
    cash: 175,
    identityId: "A-A",
    humanControlled: true,
    rosterLimit: 12,
    logoPath: null,
  };
}

function createPlayer(id: string, marketValue: number): Player {
  return {
    id,
    name: "Pvt Testfall",
    rating: 70,
    marketValue,
    salaryDemand: 10,
    displayMarketValue: marketValue,
    displaySalary: 10,
    className: "Hero",
    race: "Human",
    alignment: "N",
    gender: "f",
    referenceClass: null,
    imageSource: null,
    bracketLabel: null,
    subclasses: [],
    traitsPositive: [],
    traitsNegative: [],
    coreStats: { pow: 40, spe: 40, men: 40, soc: 40 },
    preferredDisciplineIds: [],
    disciplineRatings: { d1: 70, d2: 65 },
    disciplineTierCounts: { above20: 2, above40: 2, above60: 2, above80: 0 },
    flavorEn: "",
    flavorDe: "",
    fatigue: 0,
    form: 0,
    potential: 0,
    portraitPath: null,
    portraitUrl: null,
  };
}

function createRosterEntry(playerId: string): RosterEntry {
  return {
    id: `roster-${playerId}`,
    teamId: "A-A",
    playerId,
    contractLength: 3,
    salary: 10,
    upkeep: 10,
    purchasePrice: 41.14,
    currentValue: 41.14,
    roleTag: "starter",
    joinedSeasonId: "season-1",
  };
}

function createGameState(player: Player, roster: RosterEntry): GameState {
  return {
    gamePhase: "season_end_management",
    season: { id: "season-1", name: "Season 1", year: 2026, currentMatchday: 1, matchdayIds: ["matchday-1"] },
    seasonState: {
      seasonId: "season-1",
      sponsorPayoutLogs: [],
      schedule: [],
      standings: {},
      playerDisciplinePerformances: [],
      seasonSnapshots: [],
      matchdayResults: [],
    },
    matchdayState: { matchdayId: "matchday-1", status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams: [createTeam()],
    teamIdentities: [],
    players: [player],
    disciplines: [],
    rosters: [roster],
    contracts: [],
    transferListings: [],
    transferHistory: [],
    logs: [],
    mappingReport: {
      mappingSource: "test",
      teamSource: "test",
      generatedAt: "2026-01-01T00:00:00.000Z",
      processedMappingRows: 0,
      importedPlayerCount: 0,
      matchedRosterCount: 0,
      teamCount: 1,
      unmappedPlayers: [],
      teamsWithoutPlayers: [],
      mappingRowsWithoutPlayerMatch: [],
      duplicateMappedPlayers: [],
      unknownTeamCodes: [],
      duplicateTeamCodes: [],
      warnings: [],
    },
  } as GameState;
}

/** de-DE-formatierte Zahl ("41,1" / "−10,7") zurück in eine JS-Zahl. */
function parseNlNumber(text: string): number {
  return Number(text.replace(/−/g, "-").replace(/\./g, "").replace(",", "."));
}

describe("Kaderkarte und Spielerliste zeigen dieselbe VK-Zahl (Definitions-Gleichheit)", () => {
  const player = createPlayer("p-vk-test", 41.14);
  const roster = createRosterEntry(player.id);
  const gameState = createGameState(player, roster);

  const entry = buildExpectedSellValueByPlayerId(gameState).get(player.id)!;

  it("die Fixture hat tatsächlich einen offenen Buyout — sonst prüft der Test nichts", () => {
    expect(entry).toBeTruthy();
    expect(entry.buyoutCost).toBeGreaterThan(0);
    // Brutto und Netto müssen sich unterscheiden, sonst kann der Test die beiden Felder nicht
    // auseinanderhalten.
    expect(entry.grossSalePrice).not.toBeCloseTo(entry.expectedSellValue, 2);
  });

  it("resolveTeamsPortraitSellValueDisplay liefert grossSalePrice, NICHT expectedSellValue", () => {
    const display = resolveTeamsPortraitSellValueDisplay({ entry, marketValue: player.displayMarketValue });
    expect(display.vkValue).toBe(entry.grossSalePrice);
    expect(display.vkValue).not.toBe(entry.expectedSellValue);
  });

  it("die tatsächlich gerenderte Kaderkarte zeigt denselben Brutto-VK-Wert wie die Spielerliste (row.sellPreview.grossSalePrice)", () => {
    // "row.sellPreview.grossSalePrice" ist exakt die Zahl, die die VK-Wert-Spalte der
    // Spielerliste rendert (durchgesetzt von tests/players-table-sell-value-gross.test.ts).
    // Für denselben Eintrag muss die Karte an WERTEN dieselbe Zahl zeigen.
    const spielerlisteVkWert = entry.grossSalePrice;

    const display = resolveTeamsPortraitSellValueDisplay({ entry, marketValue: player.displayMarketValue });
    const mwZellenText = buildTeamsPortraitMwValueText({ marketValue: player.displayMarketValue, sellValueDisplay: display });

    const html = renderToString(
      <FoundationPlayerPortraitCard
        playerId={player.id}
        name={player.name}
        portraitUrl={null}
        portraitInitials="PT"
        playerOvr={68.1}
        playerMvs={15.5}
        playerPps={14.4}
        pow={40}
        spe={40}
        men={40}
        soc={40}
        variant="team"
        newLook
        interactive={false}
        economyStats={[{ label: "MW", value: mwZellenText, title: display.tooltip }]}
      />,
    );

    // Die Karte muss den VK-Preis in Klammern hinter dem Marktwert zeigen (Chris' Entscheidung:
    // MW ist die Leitzahl, VK steht dahinter in Klammern) — als Text extrahiert und als ZAHL
    // verglichen, nicht als String-Fundstelle.
    const match = html.match(/\(VK\s+([\d.,−-]+)/);
    expect(match, `VK-Klammer nicht im gerenderten HTML gefunden:\n${html}`).toBeTruthy();
    const kartenVkWert = parseNlNumber(match![1]);

    expect(kartenVkWert).toBeCloseTo(spielerlisteVkWert, 1);
    // Die (falsche) Netto-Zahl, die die Karte VORHER zeigte, darf NICHT mehr auftauchen.
    expect(kartenVkWert).not.toBeCloseTo(entry.expectedSellValue, 1);
  });
});
