import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { resolveSeasonGuvByTeam } from "@/lib/finance/season-guv-resolver";
import { makePlayer, makeRosterEntry, makeTeam, makeTeamIdentity } from "./_fixtures/game-entity-fixtures";

/**
 * `lib/finance/season-guv-resolver.ts` hatte bisher KEINEN eigenen Test — nur die reine Funktion
 * `buildSeasonGuv` (siehe `season-end-guv.test.ts`) war abgesichert. Der Resolver ist aber die
 * Stelle, über die jeder echte Aufrufer (Saisonstand-API, Finanzen-Tab, Saisonende-Buchung) den
 * Transfer-Saldo tatsächlich hineinreicht (`transferNetByTeamId`) — ein Regressionsrisiko liegt
 * also nicht nur im `counted`-Flag der reinen Funktion, sondern auch in der Verdrahtung selbst.
 *
 * AUFTRAG (Chris, wörtlich): „Lass transfers aus der GuV am besten raus die sind separat
 * ausgewiesen." Transfers haben im Saisonstand bereits eine eigene Spalte (`transfers`/
 * `transferNet`); sie zusätzlich in der GuV zu führen zählt sie doppelt.
 */
function buildTwoTeamGameState(input: { transferNetByTeamId?: Map<string, number> }): GameState {
  const teamA = makeTeam({ teamId: "team-a", shortCode: "TA", name: "Team A", cash: 100, budget: 100 });
  const teamB = makeTeam({ teamId: "team-b", shortCode: "TB", name: "Team B", cash: 80, budget: 100 });
  const player = makePlayer({ id: "player-1", name: "Star One" });
  const roster = makeRosterEntry({ id: "r1", teamId: "team-a", playerId: "player-1", salary: 20 });

  return {
    season: { id: "season-2", name: "Season 2", year: 2, currentMatchday: 1, matchdayIds: ["md-1"] },
    matchdayState: { matchdayId: "md-1" },
    teams: [teamA, teamB],
    teamIdentities: [makeTeamIdentity({ teamId: "team-a" }), makeTeamIdentity({ teamId: "team-b" })],
    teamStrategyProfiles: [],
    players: [player],
    rosters: [roster],
    disciplines: [],
    transferHistory: [],
    playerProgressionEvents: [],
    seasonState: {
      seasonId: "season-2",
      loans: [],
      standings: {
        "team-a": { teamId: "team-a", points: 20, rank: 1 },
        "team-b": { teamId: "team-b", points: 10, rank: 2 },
      },
      matchdayResults: [],
      disciplineResults: [],
      playerDisciplinePerformances: [],
      formCards: [],
      facilityEvents: [],
      teamFacilities: {},
      seasonSnapshots: [],
    },
  } as unknown as GameState;
}

describe("season-guv-resolver: Transfer-Saldo zählt nicht in die GuV", () => {
  it("guv/einnahmen/ausgaben bleiben gleich, ob transferNetByTeamId gefüllt ist oder nicht", () => {
    const gameState = buildTwoTeamGameState({});

    const ohneTransfer = resolveSeasonGuvByTeam(gameState);
    const mitTransfer = resolveSeasonGuvByTeam(gameState, {
      transferNetByTeamId: new Map([
        ["team-a", -193.7],
        ["team-b", 42.1],
      ]),
    });

    for (const teamId of ["team-a", "team-b"]) {
      const ohne = ohneTransfer.get(teamId);
      const mit = mitTransfer.get(teamId);
      expect(ohne).toBeDefined();
      expect(mit).toBeDefined();
      if (!ohne || !mit) continue;

      // Die Zahl, die überall angezeigt wird, darf sich durch den Transfer-Saldo NICHT ändern.
      expect(mit.guv).toBe(ohne.guv);
      expect(mit.einnahmen).toBe(ohne.einnahmen);
      expect(mit.ausgaben).toBe(ohne.ausgaben);

      // Auch jeder übrige Posten bleibt unverändert — nur die Transfers-Zeile selbst darf sich
      // im Betrag unterscheiden, ihr `counted`-Flag bleibt in beiden Fällen `false`.
      for (const key of ["sponsor", "gebaeude_einnahme", "apron", "boardziele", "gehaelter", "gebaeude_unterhalt", "kreditzins", "kredittilgung"] as const) {
        const posOhne = ohne.posten.find((entry) => entry.key === key);
        const posMit = mit.posten.find((entry) => entry.key === key);
        expect(posMit?.amount).toBe(posOhne?.amount);
        expect(posMit?.counted).toBe(posOhne?.counted);
      }
    }

    // Die Transfers-Zeile selbst trägt den übergebenen Saldo, zählt aber nicht mit.
    const transfersA = mitTransfer.get("team-a")?.posten.find((entry) => entry.key === "transfers");
    expect(transfersA?.amount).toBe(-193.7);
    expect(transfersA?.counted).toBe(false);
    const transfersAOhne = ohneTransfer.get("team-a")?.posten.find((entry) => entry.key === "transfers");
    expect(transfersAOhne?.amount).toBe(0);
    expect(transfersAOhne?.counted).toBe(false);
  });
});
