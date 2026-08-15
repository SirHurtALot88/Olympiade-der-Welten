import { describe, expect, it } from "vitest";

import type { GameState, Player, RosterEntry, Team } from "@/lib/data/olyDataTypes";
import { ensureLocalTeamPowersForSeason } from "@/lib/lineups/team-powers";

/**
 * `ensureLocalTeamPowersForSeason` gab frueher IMMER ein neues `gameState`-Objekt heraus,
 * auch wenn kein einziger Datensatz anders war. Die Aufrufer (KI-Aufstellungs-Batch,
 * Einsatzlisten-Dienst, MVP-Wertung) schliessen aus der neuen Referenz auf „geaendert" und
 * schreiben daraufhin den kompletten Spielstand — am Live-Save rund 1,2 s pro Schreibvorgang.
 *
 * Der Kurzschluss ist derselbe, den das Geschwister `ensureLocalFormCardsForSeason` schon
 * hat. Diese Suite haelt ihn fest.
 */

const SAVE_ID = "save-team-powers-idempotent";
const SEASON_ID = "season-1";

function createTeam(teamId: string): Team {
  return {
    teamId,
    shortCode: teamId,
    name: `Team ${teamId}`,
    budget: 500,
    cash: 500,
    identityId: teamId,
    humanControlled: false,
    rosterLimit: 12,
    logoPath: null,
  };
}

function createPlayer(id: string): Player {
  return {
    id,
    name: id,
    rating: 50,
    marketValue: 20,
    salaryDemand: 5,
    displayMarketValue: 20,
    displaySalary: 5,
    pps: null,
    ovr: null,
    className: "Berserker",
    race: "Human",
    alignment: "N",
    gender: "f",
    referenceClass: null,
    imageSource: null,
    bracketLabel: null,
    subclasses: [],
    traitsPositive: [],
    traitsNegative: [],
    coreStats: { pow: 10, spe: 10, men: 10, soc: 10 },
    preferredDisciplineIds: [],
    disciplineRatings: { d1: 10, d2: 10 },
    disciplineTierCounts: { above20: 0, above40: 0, above60: 0, above80: 0 },
    flavorEn: "",
    flavorDe: "",
    fatigue: 0,
    form: 0,
    potential: 0,
    portraitPath: null,
    portraitUrl: null,
  };
}

function createRosterEntry(id: string, teamId: string, playerId: string): RosterEntry {
  return {
    id,
    teamId,
    playerId,
    contractLength: 3,
    salary: 5,
    upkeep: 5,
    purchasePrice: 20,
    currentValue: 20,
    roleTag: "starter",
    promisedRole: null,
    joinedSeasonId: SEASON_ID,
  };
}

function baseGameState(): GameState {
  const teams = [createTeam("A-A"), createTeam("B-B")];
  const players = [createPlayer("p-a1"), createPlayer("p-a2"), createPlayer("p-b1"), createPlayer("p-b2")];
  return {
    season: {
      id: SEASON_ID,
      name: "Season 1",
      year: 2026,
      currentMatchday: 1,
      matchdayIds: ["matchday-1"],
    },
    gamePhase: "matchday_planning",
    seasonState: {
      seasonId: SEASON_ID,
      schedule: [],
      standings: Object.fromEntries(teams.map((team) => [team.teamId, { points: 0 }])),
      lineupDrafts: [],
    },
    matchdayState: {
      matchdayId: "matchday-1",
      status: "planning",
      pendingTeamIds: [],
      resolvedFixtureIds: [],
    },
    teams,
    teamIdentities: [],
    players,
    disciplines: [],
    rosters: [
      createRosterEntry("r-a1", "A-A", "p-a1"),
      createRosterEntry("r-a2", "A-A", "p-a2"),
      createRosterEntry("r-b1", "B-B", "p-b1"),
      createRosterEntry("r-b2", "B-B", "p-b2"),
    ],
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

describe("ensureLocalTeamPowersForSeason", () => {
  it("gibt beim zweiten Lauf denselben gameState zurueck, wenn sich nichts geaendert hat", () => {
    const erster = ensureLocalTeamPowersForSeason(baseGameState(), SAVE_ID, SEASON_ID);
    const zweiter = ensureLocalTeamPowersForSeason(erster, SAVE_ID, SEASON_ID);

    // Referenzgleichheit ist hier die eigentliche Zusicherung: nur so erkennen die Aufrufer,
    // dass nichts zu schreiben ist.
    expect(zweiter).toBe(erster);
    expect(zweiter.seasonState.teamPowers).toBe(erster.seasonState.teamPowers);
  });

  it("erzeugt die Powers beim ersten Lauf weiterhin", () => {
    const leer = baseGameState();
    const erster = ensureLocalTeamPowersForSeason(leer, SAVE_ID, SEASON_ID);

    expect(erster).not.toBe(leer);
    expect((erster.seasonState.teamPowers ?? []).length).toBeGreaterThan(0);
  });

  it("behaelt die gespeicherte Saison-Auswahl und schreibt dafuer NICHT", () => {
    const erster = ensureLocalTeamPowersForSeason(baseGameState(), SAVE_ID, SEASON_ID);
    const powers = erster.seasonState.teamPowers ?? [];
    expect(powers.length).toBeGreaterThan(0);

    // `selectedForSeason` ist genau das Feld, das der Merge aus dem BESTAND uebernimmt
    // (`existingById.get(...)?.selectedForSeason ?? ...`). Eine abweichende Auswahl ist also
    // kein Unterschied, den der Lauf einebnen muesste — sie gewinnt und bleibt stehen.
    const gewaehlt: GameState = {
      ...erster,
      seasonState: {
        ...erster.seasonState,
        teamPowers: powers.map((power, index) =>
          index === 0 ? { ...power, selectedForSeason: !power.selectedForSeason } : power,
        ),
      },
    };

    const zweiter = ensureLocalTeamPowersForSeason(gewaehlt, SAVE_ID, SEASON_ID);
    expect(zweiter).toBe(gewaehlt);
    expect((zweiter.seasonState.teamPowers ?? [])[0]?.selectedForSeason).toBe(
      !powers[0].selectedForSeason,
    );
  });

  it("heilt einen generator-eigenen Wert und gibt dafuer ein neues Objekt heraus", () => {
    const erster = ensureLocalTeamPowersForSeason(baseGameState(), SAVE_ID, SEASON_ID);
    const powers = erster.seasonState.teamPowers ?? [];
    expect(powers.length).toBeGreaterThan(0);
    const sollModifier = powers[0].modifier;

    // `modifier` kommt im Merge aus der Neugenerierung. Ein abweichender Bestandswert muss
    // ueberschrieben werden — und genau dann darf der Lauf auch wieder schreiben.
    const verfaelscht: GameState = {
      ...erster,
      seasonState: {
        ...erster.seasonState,
        teamPowers: powers.map((power, index) =>
          index === 0 ? { ...power, modifier: power.modifier + 13 } : power,
        ),
      },
    };

    const zweiter = ensureLocalTeamPowersForSeason(verfaelscht, SAVE_ID, SEASON_ID);
    expect(zweiter).not.toBe(verfaelscht);
    expect((zweiter.seasonState.teamPowers ?? [])[0]?.modifier).toBe(sollModifier);
  });

  it("ergaenzt fehlende Powers additiv, statt den Bestand einzufrieren", () => {
    const voll = ensureLocalTeamPowersForSeason(baseGameState(), SAVE_ID, SEASON_ID);
    const alle = voll.seasonState.teamPowers ?? [];
    expect(alle.length).toBeGreaterThan(1);

    const luecke: GameState = {
      ...voll,
      seasonState: { ...voll.seasonState, teamPowers: alle.slice(1) },
    };

    const geheilt = ensureLocalTeamPowersForSeason(luecke, SAVE_ID, SEASON_ID);
    expect(geheilt).not.toBe(luecke);
    expect((geheilt.seasonState.teamPowers ?? []).length).toBe(alle.length);
  });
});
