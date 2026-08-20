/**
 * CHRIS' ENTSCHEIDUNG (20.08.2026): „opt +1 für alle teams außer die die schon 14 haben".
 *
 * Sie folgt aus der Fatigue-Messung (`ne85u5`): die Erholung deckt rund 63,6 % Einsatzquote,
 * gespielt werden 73–90 %. Rechnerisch braucht ein Team 13–15 Spieler, um durchrotieren zu können;
 * die Zielgröße stand über die fünf Live-Abbilder gemessen im Median bei 11 (Spanne 8–14, 10 von
 * 160 Teams schon am Maximum).
 *
 * DREI ZUSAGEN, und alle drei sind je eine eigene Art, das falsch zu machen:
 *   1. Jedes Team bekommt genau EIN Plus — nicht zwei, nicht keins.
 *   2. Teams am Maximum (14) bleiben stehen, statt darüber zu klettern.
 *   3. Die Anhebung greift EINMAL. Sie läuft im Ladepfad, der bei jedem Öffnen durchlaufen wird —
 *      ohne Stufenzähler kletterte die Zahl bei jedem Laden weiter, bis alle Teams bei 14 stünden.
 *      Das ist der Fehler, der hier am meisten wehtäte, und er wäre im Spiel erst nach Tagen
 *      aufgefallen.
 */
import { describe, expect, it } from "vitest";

import type { GameState, Team, TeamIdentity } from "@/lib/data/olyDataTypes";
import { normalizeLegacyRosterTargets } from "@/lib/persistence/save-repository";

function team(teamId: string): Team {
  return {
    teamId,
    shortCode: teamId,
    name: teamId,
    budget: 100,
    cash: 50,
    identityId: teamId,
    humanControlled: false,
    rosterLimit: 14,
    logoPath: null,
  } as Team;
}

function identity(teamId: string, playerOpt: number): TeamIdentity {
  return { teamId, playerMin: 8, playerOpt, playerMax: 14, finances: 5, ambition: 5 } as unknown as TeamIdentity;
}

function baueSpielstand(zielgroessen: Record<string, number>, bumpVersion?: number): GameState {
  const teamIds = Object.keys(zielgroessen);
  return {
    ...(bumpVersion == null ? {} : { rosterOptBumpVersion: bumpVersion }),
    season: { id: "season-2", name: "Season 2", year: 2, currentMatchday: 1, matchdayIds: ["md-1"] },
    seasonState: { seasonId: "season-2", schedule: [], standings: {} },
    matchdayState: { matchdayId: "md-1", status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams: teamIds.map(team),
    teamIdentities: teamIds.map((teamId) => identity(teamId, zielgroessen[teamId]!)),
    players: [],
    rosters: [],
    contracts: [],
    transferListings: [],
    transferHistory: [],
    logs: [],
    disciplines: [],
    mappingReport: {
      mappingSource: "test",
      teamSource: "test",
      generatedAt: "2026-08-20T00:00:00.000Z",
      processedMappingRows: 0,
      importedPlayerCount: 0,
      matchedRosterCount: 0,
      teamCount: teamIds.length,
      unmappedPlayers: [],
    },
  } as unknown as GameState;
}

const optVon = (gameState: GameState, teamId: string) =>
  gameState.teamIdentities.find((eintrag) => eintrag.teamId === teamId)?.playerOpt ?? null;

describe("Die Kader-Zielgröße steigt einmalig um eins", () => {
  it("hebt jedes Team um genau eins an", () => {
    const ergebnis = normalizeLegacyRosterTargets(baueSpielstand({ "A-A": 8, "B-B": 10, "C-C": 11, "D-D": 13 }));
    expect(optVon(ergebnis, "A-A")).toBe(9);
    expect(optVon(ergebnis, "B-B")).toBe(11);
    expect(optVon(ergebnis, "C-C")).toBe(12);
    expect(optVon(ergebnis, "D-D")).toBe(14);
  });

  it("lässt Teams stehen, die schon am Maximum sind", () => {
    const ergebnis = normalizeLegacyRosterTargets(baueSpielstand({ "E-E": 14 }));
    expect(optVon(ergebnis, "E-E")).toBe(14);
  });

  it("greift NUR EINMAL — ein zweites Laden hebt nicht noch einmal an", () => {
    const einmal = normalizeLegacyRosterTargets(baueSpielstand({ "A-A": 10 }));
    const zweimal = normalizeLegacyRosterTargets(einmal);
    const dreimal = normalizeLegacyRosterTargets(zweimal);
    expect(optVon(einmal, "A-A")).toBe(11);
    expect(optVon(zweimal, "A-A")).toBe(11);
    expect(optVon(dreimal, "A-A")).toBe(11);
  });

  it("stempelt die Stufe in den Spielstand, damit sie das Speichern überlebt", () => {
    const ergebnis = normalizeLegacyRosterTargets(baueSpielstand({ "A-A": 10 }));
    expect(ergebnis.rosterOptBumpVersion).toBe(1);
  });

  it("rührt einen Spielstand nicht an, der die Stufe schon trägt", () => {
    const schonAngehoben = baueSpielstand({ "A-A": 11 }, 1);
    expect(optVon(normalizeLegacyRosterTargets(schonAngehoben), "A-A")).toBe(11);
  });

  it("zieht die neue Zielgröße auch in die Team-Spiegelung (rosterOptTarget)", () => {
    // Der Spiegel auf dem Team ist das, was Kader-Anzeige und Teile der KI lesen. Bliebe er auf der
    // alten Zahl stehen, stünden zwei Zielgrößen nebeneinander — genau der Zustand, den die
    // Anhebung in den Daten (statt nur in der Ableitung) vermeiden soll.
    const ergebnis = normalizeLegacyRosterTargets(baueSpielstand({ "A-A": 10 }));
    expect(ergebnis.teams.find((eintrag) => eintrag.teamId === "A-A")?.rosterOptTarget).toBe(11);
  });
});
