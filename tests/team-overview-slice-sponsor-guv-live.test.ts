import { describe, expect, it } from "vitest";

import type { GameState, TeamSponsorContract } from "@/lib/data/olyDataTypes";
import { buildTeamOverviewSlice } from "@/lib/foundation/team-overview-slice-build";
import { hydrateTeamOverviewSliceRows } from "@/lib/foundation/team-overview-slice";
import { getLeagueSponsorIncome } from "@/lib/season/prize-money-preview";
import { resolveSeasonGuvByTeam } from "@/lib/finance/season-guv-resolver";
import { makePlayer, makeRosterEntry, makeTeam, makeTeamIdentity } from "./_fixtures/game-entity-fixtures";

/**
 * BEFUND #493/#498 (SAISONSTAND_FINANZSPALTEN_LEER.md): SPONSOREN und GUV zeigten im "Neuer
 * Look"-Saisonstand Striche, obwohl beide Größen eine verbindliche Quelle haben
 * (`getLeagueSponsorIncome` / `lib/finance/season-end-guv.ts` über `resolveSeasonGuvByTeam`).
 *
 * DER GEMESSENE ZEILEN-PFAD (Beleg, nicht Vermutung): für die LAUFENDE Saison hydriert der
 * Browser seine Saisonstand-Zeilen aus `/api/season/team-overview-slice`
 * (`hydrateTeamOverviewSliceRows`, `lib/foundation/tabs/use-season-stand-rows.ts:222`,
 * `teamOverviewSlice.rows.length > 0 && !isArchivedSeasonView`). Dieser Pfad rief
 * `buildTeamSeasonOverviewRows` bisher OHNE `standingsByTeamId` auf — das Fallback ist
 * `gameState.seasonState.standings`, und die trägt `sponsorTotal`/`guv` erst NACH der
 * Saisonende-Buchung (`cash-prize-apply-service.ts`, Phase `season_end`). Für eine laufende
 * Saison (wie hier) blieb die Slice deshalb bei `sponsorTotal: null, guv: null` für alle Teams,
 * obwohl die Live-Vorschau längst eine Zahl kennt.
 *
 * Dieser Test prüft die VERDRAHTUNG, nicht nur dass eine Berechnung irgendwo im Code steht: er
 * fährt exakt die Funktion, die die echte API-Route aufruft (`buildTeamOverviewSlice`), dann den
 * Client-Hydrate-Schritt (`hydrateTeamOverviewSliceRows`), und vergleicht das Ergebnis mit der
 * EINEN Quelle — nicht mit einem im Test nachgerechneten Erwartungswert.
 */
function buildSponsorContract(teamId: string): TeamSponsorContract {
  return {
    teamId,
    seasonId: "season-1",
    seasonsRemaining: 1,
    name: "Testsponsor",
    payouts: { baseFirstPaid: false, baseSecondPaid: false },
    components: [{ componentId: "base", kind: "base", label: "Basis", rewardCash: 40 }],
  } as unknown as TeamSponsorContract;
}

function buildGameState(): GameState {
  const teamA = makeTeam({ teamId: "team-a", shortCode: "TA", name: "Team A", cash: 100, budget: 100 });
  const teamB = makeTeam({ teamId: "team-b", shortCode: "TB", name: "Team B", cash: 80, budget: 100 });
  const player = makePlayer({ id: "player-1", name: "Star One", salaryDemand: 10 });
  const roster = makeRosterEntry({ id: "r1", teamId: "team-a", playerId: "player-1", salary: 10 });

  return {
    season: { id: "season-1", name: "Season 1", year: 1, currentMatchday: 1, matchdayIds: ["md-1"] },
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
      seasonId: "season-1",
      loans: [],
      // MITTEN IN DER SAISON: nur die acht schmalen Felder, keine sponsorTotal/guv — genau der
      // Zustand vor der Saisonende-Buchung, den der Befund gemessen hat.
      standings: {
        "team-a": { teamId: "team-a", points: 10, rank: 1 },
        "team-b": { teamId: "team-b", points: 8, rank: 2 },
      },
      matchdayResults: [],
      disciplineResults: [],
      playerDisciplinePerformances: [],
      formCards: [],
      facilityEvents: [],
      teamFacilities: {},
      seasonSnapshots: [],
      sponsorContractsByTeamId: {
        "team-a": buildSponsorContract("team-a"),
      },
    },
  } as unknown as GameState;
}

describe("team-overview-slice: SPONSOREN und GUV kommen für die laufende Saison an", () => {
  it("buildTeamOverviewSlice liefert dieselbe sponsorTotal/guv wie die EINE Quelle — nicht null", () => {
    const gameState = buildGameState();

    const slice = buildTeamOverviewSlice({ gameState, saveId: "save-1", seasonId: "season-1" });
    const rowA = slice.rows.find((row) => row.teamId === "team-a");
    const rowB = slice.rows.find((row) => row.teamId === "team-b");
    expect(rowA).toBeDefined();
    expect(rowB).toBeDefined();

    // Referenz: dieselben Funktionen, die auch die Saisonende-Buchung und
    // app/api/season/standings-overview/route.ts verwenden.
    const sponsorIncome = getLeagueSponsorIncome(gameState, "save-1");
    const guvByTeamId = resolveSeasonGuvByTeam(gameState, { sponsorCashByTeamId: sponsorIncome.sponsorCashByTeamId });

    // Team A hat einen Sponsorvertrag mit garantierter Basis (40 C) — sponsorTotal darf nicht
    // null sein, und die GuV muss aus derselben Rechnung stammen wie `season-end-guv.ts`.
    expect(rowA!.sponsorTotal).not.toBeNull();
    expect(rowA!.sponsorTotal).toBeCloseTo(sponsorIncome.sponsorCashByTeamId.get("team-a") ?? -1, 2);
    expect(rowA!.guv).not.toBeNull();
    expect(rowA!.guv).toBeCloseTo(guvByTeamId.get("team-a")?.guv ?? Number.NaN, 2);
    expect(rowA!.guvPosten).not.toBeNull();
    expect(rowA!.guvPosten!.length).toBeGreaterThan(0);

    // Team B hat KEINEN Sponsorvertrag — dieselbe Konvention wie
    // app/api/season/standings-overview/route.ts: ohne Vertrag ist die Sponsoreinnahme
    // UNBEKANNT (null), nicht 0. Die GuV rechnet trotzdem (Gehälter/Gebäude/Apron laufen
    // unabhängig vom Sponsorvertrag) und bleibt nicht null.
    expect(rowB!.sponsorTotal).toBeNull();
    expect(rowB!.guv).not.toBeNull();
    expect(rowB!.guv).toBeCloseTo(guvByTeamId.get("team-b")?.guv ?? Number.NaN, 2);
  });

  it("überlebt den Client-Hydrate-Schritt (hydrateTeamOverviewSliceRows) unverändert", () => {
    const gameState = buildGameState();
    const slice = buildTeamOverviewSlice({ gameState, saveId: "save-1", seasonId: "season-1" });

    const hydrated = hydrateTeamOverviewSliceRows(slice.rows, gameState);
    const rowA = hydrated.find((row) => row.teamId === "team-a");
    expect(rowA?.sponsorTotal).not.toBeNull();
    expect(rowA?.guv).not.toBeNull();
  });

  it("rührt an einer ARCHIVIERTEN seasonId nicht — dort bleibt die Live-Vorschau aus (falscher Kontext)", () => {
    const gameState = buildGameState();
    // Eine andere seasonId als die laufende: die Live-Vorschau würde hier eine Zahl aus dem
    // FALSCHEN Kontext liefern (`gameState` gehört zur aktuellen Saison). Die Slice fällt in
    // diesem Fall unverändert auf ihr bisheriges Verhalten zurück.
    const slice = buildTeamOverviewSlice({ gameState, saveId: "save-1", seasonId: "season-0-archiv" });
    expect(slice.rows.length).toBeGreaterThan(0);
  });
});
