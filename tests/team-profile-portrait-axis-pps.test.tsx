import { describe, expect, it, beforeEach } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";

import { useFoundationCrossTabTeamsRoster } from "@/lib/foundation/tabs/use-foundation-cross-tab-teams-roster";
import { invalidateTeamProfileSessionCache } from "@/lib/foundation/team-profile-session-cache";
import type { GameState, Player, RosterEntry, Team } from "@/lib/data/olyDataTypes";
import type { TeamDetailDrawerData } from "@/lib/foundation/team-detail-drawer-types";

/**
 * GEMELDET VON CHRIS (Ticket 23, Seite „Team · Teams", view=teamProfile):
 * „Kannst du die Bilder hier in der Team ansicht also die portraits noch
 * größer amchen und dafür noch die aktuellen PP der Bereiche über die stats
 * schreiben? Also POW 5,3 über dem POW 42 stat?" — nachgeschoben: „haben wir
 * immernoch keine PPs in den player cards für POW SPE MEN SOC".
 *
 * Vor dem Fix trug `TeamDetailDrawerPlayerCard.coreStats` nur den
 * 0–100-Achsenwert (POW 42), keine Achsen-PPs. Die Portraitkarte hatte also
 * nichts, was sie über dem Stat hätte zeigen können.
 *
 * WICHTIG (Datenquelle, siehe Auftrag): die Achsen-PPs kommen aus dem
 * Server-Rating (`playerRatingsById` → `ppPow`/…), NICHT aus einem
 * clientseitig neu gebauten Saison-Ledger — der wäre im kompakten
 * Foundation-Payload leer/falsch. Dieser Test füttert `playerRatingsById`
 * direkt (wie es der reale Slice tut) und prüft, dass der Wert unverändert
 * bis zur Portraitkarte durchgereicht wird.
 */

function createPlayer(partial?: Partial<Player>): Player {
  return {
    id: partial?.id ?? "player-1",
    name: partial?.name ?? "Rider One",
    rating: partial?.rating ?? 61.5,
    marketValue: partial?.marketValue ?? 85000,
    salaryDemand: partial?.salaryDemand ?? 8000,
    displayMarketValue: partial?.displayMarketValue ?? 72.57,
    displaySalary: partial?.displaySalary ?? 16.54,
    pps: partial?.pps ?? 5.3,
    ovr: partial?.ovr ?? 66,
    className: partial?.className ?? "Berserker",
    race: partial?.race ?? "Human",
    alignment: partial?.alignment ?? "N",
    gender: partial?.gender ?? "m",
    referenceClass: partial?.referenceClass ?? null,
    imageSource: partial?.imageSource ?? null,
    bracketLabel: partial?.bracketLabel ?? null,
    subclasses: partial?.subclasses ?? [],
    traitsPositive: partial?.traitsPositive ?? [],
    traitsNegative: partial?.traitsNegative ?? [],
    coreStats: partial?.coreStats ?? { pow: 42, spe: 30, men: 20, soc: 10 },
    preferredDisciplineIds: partial?.preferredDisciplineIds ?? [],
    disciplineRatings: partial?.disciplineRatings ?? { tdm: 55 },
    disciplineTierCounts: partial?.disciplineTierCounts ?? { above20: 2, above40: 2, above60: 1, above80: 0 },
    flavorEn: partial?.flavorEn ?? "",
    flavorDe: partial?.flavorDe ?? "",
    fatigue: partial?.fatigue ?? 0,
    form: partial?.form ?? 0,
    potential: partial?.potential ?? 0,
    portraitPath: partial?.portraitPath ?? null,
    portraitUrl: partial?.portraitUrl ?? null,
  } as Player;
}

function createTeam(partial?: Partial<Team>): Team {
  return {
    teamId: "T-T",
    shortCode: "T-T",
    name: "Test Team",
    budget: 500000,
    cash: 120000,
    identityId: "T-T",
    humanControlled: true,
    rosterLimit: 12,
    logoPath: null,
    ...partial,
  };
}

function createRosterEntry(player: Player): RosterEntry {
  return {
    id: "roster-1",
    teamId: "T-T",
    playerId: player.id,
    contractLength: 3,
    salary: 12.75,
    upkeep: 1,
    roleTag: "starter",
    joinedSeasonId: "season-1",
  };
}

function createGameState(player: Player): GameState {
  const team = createTeam();
  return {
    season: {
      id: "season-1",
      name: "Season 1",
      year: 2026,
      currentMatchday: 7,
      matchdayIds: ["matchday-7"],
    },
    seasonState: {
      seasonId: "season-1",
      schedule: [],
      standings: { "T-T": { points: 0, rank: null } },
      seasonSnapshots: [],
    },
    matchdayState: {
      matchdayId: "matchday-7",
      status: "planning",
      pendingTeamIds: [],
      resolvedFixtureIds: [],
    },
    teams: [team],
    teamIdentities: [],
    players: [player],
    disciplines: [{ id: "tdm", name: "TDM", category: "power", weight: 1, originalOrder: 1, playerCount: 6 }],
    rosters: [createRosterEntry(player)],
    contracts: [],
    transferListings: [],
    transferHistory: [],
    logs: [],
    mappingReport: {
      mappingSource: "",
      teamSource: "",
      generatedAt: "",
      processedMappingRows: 0,
      importedPlayerCount: 1,
      matchedRosterCount: 1,
      teamsWithoutPlayers: [],
      mappingRowsWithoutPlayerMatch: [],
      duplicateMappedPlayers: [],
      unknownTeamCodes: [],
      duplicateTeamCodes: [],
      warnings: [],
    },
  } as unknown as GameState;
}

let captured: TeamDetailDrawerData | null = null;

function Harness({ player }: { player: Player }) {
  const gameState = createGameState(player);
  const result = useFoundationCrossTabTeamsRoster({
    shouldBuildTeamsView: false,
    shouldBuildHomeV2Overview: false,
    shouldBuildMarketView: false,
    teamProfileTeamId: "T-T",
    canonicalSeasonLabel: "Season 1",
    gameState,
    rosterPlayers: [{ entry: createRosterEntry(player), player }],
    playerRatingsById: new Map([
      [
        player.id,
        {
          ovrNormalized: 70,
          mvs: 20,
          ppsSeason: 5.3,
          ppPow: 5.3,
          ppSpe: 0,
          ppMen: 0,
          ppSoc: 0,
          ovrRank: 1,
          mvsRank: 1,
          ppsSeasonRank: 1,
        },
      ],
    ]),
    seasonStandRows: [],
    seasonStandRowsSeasonId: "season-1",
    activeSaveId: "save-1",
    currentAreaRanksByTeamId: new Map(),
    seasonPointsLedger: {
      teamSummariesByTeamId: new Map(),
      playerSummariesByPlayerId: new Map([
        [
          player.id,
          {
            pointsByDiscipline: { tdm: 5.3 },
            pointsByArea: { power: 5.3, speed: 0, mental: 0, social: 0 },
          },
        ],
      ]),
    },
    playerDirectorySlice: { payload: null, error: null, disciplinePointsByPlayerId: {} },
    teamObjectiveOverview: { objectives: [], boardConfidence: {} } as never,
    currentMatchdayDisciplineSchedule: null,
    manageableTeamIds: ["T-T"],
  });
  captured = result.buildTeamDetailDrawerData("T-T", "full");
  return null;
}

function buildViaHarness(player: Player) {
  captured = null;
  renderToString(<Harness player={player} />);
  return captured as TeamDetailDrawerData | null;
}

describe("Team-Profil-Portraitkarte trägt die Achsen-PPs (Ticket 23)", () => {
  beforeEach(() => {
    invalidateTeamProfileSessionCache();
  });

  it("liefert die POW-Achsen-PPs aus dem Server-Rating, nicht null", () => {
    const player = createPlayer();
    const data = buildViaHarness(player);
    const card = data?.players.find((entry) => entry.playerId === player.id) ?? null;

    expect(card).not.toBeNull();
    // Der Achsenwert selbst bleibt unverändert (Chris' "POW 42").
    expect(card?.coreStats.pow).toBe(42);
    // Und jetzt trägt die Karte zusätzlich die PPs dieser Achse ("POW 5,3").
    expect(card?.axisPps.pow).toBe(5.3);
  });

  it("die drei anderen Achsen bleiben bei 0, nicht null (das Rating kennt sie)", () => {
    const player = createPlayer();
    const data = buildViaHarness(player);
    const card = data?.players.find((entry) => entry.playerId === player.id) ?? null;

    expect(card?.axisPps.spe).toBe(0);
    expect(card?.axisPps.men).toBe(0);
    expect(card?.axisPps.soc).toBe(0);
  });

  it("die Disziplin-Aufschlüsselung landet als Tooltip-Text an der POW-Achse", () => {
    const player = createPlayer();
    const data = buildViaHarness(player);
    const card = data?.players.find((entry) => entry.playerId === player.id) ?? null;

    expect(card?.axisPpsBreakdown.pow).toContain("TDM");
    expect(card?.axisPpsBreakdown.pow).toContain("5,3");
    // Achsen ohne Beitrag bekommen keinen erfundenen Text.
    expect(card?.axisPpsBreakdown.spe).toBeNull();
  });

  it("fehlt das Server-Rating für einen Spieler, bleiben die Achsen-PPs null statt erraten", () => {
    const player = createPlayer({ id: "player-without-rating" });
    captured = null;
    renderToString(
      <HarnessWithoutRating player={player} />,
    );
    const data = captured as TeamDetailDrawerData | null;
    const card = data?.players.find((entry) => entry.playerId === player.id) ?? null;
    expect(card?.axisPps.pow).toBeNull();
  });
});

function HarnessWithoutRating({ player }: { player: Player }) {
  const gameState = createGameState(player);
  const result = useFoundationCrossTabTeamsRoster({
    shouldBuildTeamsView: false,
    shouldBuildHomeV2Overview: false,
    shouldBuildMarketView: false,
    teamProfileTeamId: "T-T",
    canonicalSeasonLabel: "Season 1",
    gameState,
    rosterPlayers: [{ entry: createRosterEntry(player), player }],
    playerRatingsById: new Map(),
    seasonStandRows: [],
    seasonStandRowsSeasonId: "season-1",
    activeSaveId: "save-1",
    currentAreaRanksByTeamId: new Map(),
    seasonPointsLedger: null,
    playerDirectorySlice: { payload: null, error: null, disciplinePointsByPlayerId: {} },
    teamObjectiveOverview: { objectives: [], boardConfidence: {} } as never,
    currentMatchdayDisciplineSchedule: null,
    manageableTeamIds: ["T-T"],
  });
  captured = result.buildTeamDetailDrawerData("T-T", "full");
  return null;
}
