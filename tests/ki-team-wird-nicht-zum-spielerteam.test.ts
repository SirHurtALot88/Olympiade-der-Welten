/**
 * GEMELDET: „und wieso ist M-S auch als mein team getaggt? Das ist ein AI Team!!! da ist irgendwas
 * durcheinander geraten durch das season ende"
 *
 * BEFUND am echten Spielstand (`new-game-1785823388048-1hf25q`): Mortal Sin trug
 *
 *   controlMode:  "manual"     ← das Spiel behandelt es als Spieler-Team
 *   displayLabel: "AI"         ← so war es gemeint
 *   ownerSlot:    "user"
 *
 * `displayLabel: "AI"` entsteht ausschliesslich zusammen mit `controlMode: "ai"`. Beim
 * Zusammenfuehren der Kontrolleinstellungen wird die Beschriftung aber BEHALTEN, waehrend der
 * Modus neu abgeleitet wird — der Widerspruch ist also die Spur einer nachtraeglichen Umschaltung.
 *
 * URSACHE, mit Zeile: `ai-preseason-manual-team-guard.ts:23` filterte auf
 * `team.humanControlled !== false`. Das ist auch fuer `undefined` wahr. Und
 * `protectManualPlayerTeams` schreibt die Annahme ZURUECK (`humanControlled: true` +
 * `controlMode: "manual"`) — ein Durchlauf genuegt, und ein KI-Team ist dauerhaft ein
 * Spieler-Team. Folge im Spiel: das Team ist von der KI-Automatik ausgenommen (alle
 * `ai*Enabled`-Schalter stehen auf false) und macht gar nichts mehr.
 */
import { describe, expect, it } from "vitest";

import { getProtectedHumanTeamIds, protectManualPlayerTeams } from "@/lib/ai/ai-preseason-manual-team-guard";
import type { GameState } from "@/lib/data/olyDataTypes";

function mkState(teams: Array<{ teamId: string; humanControlled?: boolean }>): GameState {
  return {
    season: { id: "season-1", name: "Season 1", year: 2026, currentMatchday: 1, matchdayIds: ["md-1"] },
    gamePhase: "preseason_management",
    teams: teams.map((t) => ({
      teamId: t.teamId,
      shortCode: t.teamId,
      name: `Team ${t.teamId}`,
      cash: 100,
      budget: 200,
      identityId: t.teamId,
      ...(t.humanControlled === undefined ? {} : { humanControlled: t.humanControlled }),
    })),
    teamIdentities: teams.map((t) => ({ teamId: t.teamId, identityId: t.teamId })),
    seasonState: { seasonId: "season-1", schedule: [], standings: {} },
    matchdayState: { matchdayId: "md-1", status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
    rosters: [],
    players: [],
    disciplines: [],
    contracts: [],
    transferListings: [],
    transferHistory: [],
    logs: [],
  } as never;
}

describe("Ein KI-Team wird nicht zum Spieler-Team", () => {
  it("ein Team OHNE gesetztes Flag gilt nicht als Spieler-Team", () => {
    // Der gemeldete Fall: M-S hatte kein belastbares `humanControlled`, wurde aber als Mensch
    // eingestuft. Ohne den Fix steht "K-I" in dieser Menge.
    const state = mkState([{ teamId: "S-C", humanControlled: true }, { teamId: "K-I" }]);
    expect([...getProtectedHumanTeamIds(state)]).toEqual(["S-C"]);
  });

  it("und wird auch nicht nachtraeglich dazu gemacht", () => {
    // Der eigentliche Schaden: der Schutz SCHREIBT seine Annahme in den Spielstand. Ein Durchlauf
    // genuegte, und aus dem KI-Team wurde dauerhaft ein Spieler-Team — samt `controlMode: manual`,
    // womit es aus der gesamten KI-Automatik faellt.
    const nachher = protectManualPlayerTeams(mkState([{ teamId: "S-C", humanControlled: true }, { teamId: "K-I" }]));
    const kiTeam = nachher.teams.find((team) => team.teamId === "K-I");
    expect(kiTeam?.humanControlled, "das KI-Team darf nicht auf humanControlled:true kippen").not.toBe(true);
    expect(nachher.seasonState.teamControlSettings?.["K-I"]?.controlMode ?? "ai").toBe("ai");
  });

  it("das echte Spieler-Team bleibt geschuetzt", () => {
    // Gegenrichtung: der Fix darf den Schutz nicht abschalten, sonst kauft die KI wieder im
    // Kader des Spielers (siehe PR #431).
    const state = mkState([{ teamId: "S-C", humanControlled: true }, { teamId: "K-I" }]);
    expect(getProtectedHumanTeamIds(state).has("S-C")).toBe(true);
    const nachher = protectManualPlayerTeams(state);
    expect(nachher.teams.find((team) => team.teamId === "S-C")?.humanControlled).toBe(true);
    // `teamControlSettings` bleibt hier bewusst leer: S-C ist bereits korrekt gefuehrt, also gibt
    // es nichts zu erzwingen — die Funktion reicht den Zustand unveraendert durch. Geprueft wird
    // deshalb der Schutz selbst, nicht ein Schreibvorgang, den es nicht geben soll.
  });

  it("ein Team, das die Einstellungen als manuell fuehren, bleibt ebenfalls geschuetzt", () => {
    // Zweite Quelle neben dem Flag: wer sein Team ueber die Team-Einstellungen uebernommen hat,
    // traegt `controlMode: "manual"` und muss weiter geschuetzt sein, auch ohne Flag am Team.
    const state = mkState([{ teamId: "U-B" }]);
    state.seasonState.teamControlSettings = {
      "U-B": { teamId: "U-B", controlMode: "manual", ownerId: "user_local", ownerSlot: "user" },
    } as never;
    expect([...getProtectedHumanTeamIds(state)]).toContain("U-B");
  });
});
