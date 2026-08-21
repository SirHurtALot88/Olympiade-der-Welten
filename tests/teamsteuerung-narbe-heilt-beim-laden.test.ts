/**
 * EIN KI-TEAM, DAS SICH ALS MEINES AUSGIBT — UND DEN SPIELMODUS GLEICH MIT ERFINDET.
 *
 * GEMELDET VON CHRIS (`17xs83`, „Verwaltung · Settings", Spielstand `hwz8fk`, Saison 2, MD1):
 * „Beim Switch in Season 2 ist C-C plötzlich auch ein von mir gesteuertes Team! aber nur im KI
 * Verhalten Reiter — und ich bekomme das nicht weg…"
 *
 * DER EIGENTLICHE BEFUND, und er erklärt „ich bekomme das nicht weg" wörtlich: der Spielmodus ist
 * in diesen Ständen NICHT gesetzt (`scenarioMeta.saveMode` leer), sondern wird aus der ANZAHL der
 * manuellen Teams ABGELEITET. Das falsch markierte Team hat den Modus also selbst erzeugt — und
 * die Oberfläche zeigt daraufhin „Chris 2/2 — voll", bestätigt den Fehler damit als Einstellung.
 *
 * Über die sieben Live-Spielstände gemessen:
 *
 *   hwz8fk  Modus solo_2  Chris 2/2 (C-C, S-C)  selectedTeamId S-C  meta.saveMode —  ← Narbe C-C
 *   89rv3s  Modus solo_2  Chris 2/2 (C-C, S-C)  selectedTeamId S-C  meta.saveMode —  ← dieselbe
 *   n90y4m  Modus solo_1  Chris 1/1 (C-C)       selectedTeamId C-C  meta.saveMode —  ← C-C ECHT
 *
 * Dieselbe Team-ID einmal als Narbe und einmal als echtes Spielerteam — deshalb reicht „heißt C-C"
 * als Kennzeichen nicht, und deshalb steht `n90y4m` unten als eigener Fall.
 */
import { describe, expect, it } from "vitest";

import type { GameState, Team } from "@/lib/data/olyDataTypes";
import {
  buildTeamControlSettingsMap,
  deriveChrisFrankyTeamIdsFromSettings,
  heileFalschAlsMenschMarkierteTeams,
  resolveGameModeFromState,
  withNormalizedTeamControlSettings,
} from "@/lib/foundation/team-control-settings";

function team(teamId: string): Team {
  return {
    teamId,
    shortCode: teamId,
    name: `Team ${teamId}`,
    budget: 100,
    cash: 100,
    identityId: teamId,
    humanControlled: false,
    rosterLimit: 12,
    logoPath: null,
  } as unknown as Team;
}

/**
 * Der gemessene Aufbau aus `hwz8fk`: S-C ist das gewählte Team (Etikett „Chris"), C-C trägt
 * `manual` bei Etikett „AI" — der Fingerabdruck der Narbe. Dazu ein echtes KI-Team.
 */
function spielstand(input: {
  narbeEtikett?: string;
  narbeModus?: "manual" | "ai";
  gewaehlt?: string | null;
}): GameState {
  const teams = [team("S-C"), team("C-C"), team("M-M")];
  return {
    teams,
    scenarioMeta: { scenarioType: "new_game" },
    season: { id: "season-2", currentMatchday: 1 },
    seasonState: {
      newGameFlow: { selectedTeamId: input.gewaehlt === undefined ? "S-C" : input.gewaehlt },
      teamControlSettings: {
        "S-C": { teamId: "S-C", controlMode: "manual", ownerId: "user_local", ownerSlot: "user", displayLabel: "Chris" },
        "C-C": {
          teamId: "C-C",
          controlMode: input.narbeModus ?? "manual",
          ownerId: "user_local",
          ownerSlot: "user",
          displayLabel: input.narbeEtikett ?? "AI",
        },
        "M-M": { teamId: "M-M", controlMode: "ai", ownerId: "ai", ownerSlot: "ai", displayLabel: "AI" },
      },
    },
  } as unknown as GameState;
}

function meineTeams(gameState: GameState): string[] {
  const map = buildTeamControlSettingsMap(gameState.teams, gameState.seasonState.teamControlSettings);
  const { chrisTeamIds, frankyTeamIds } = deriveChrisFrankyTeamIdsFromSettings(gameState.teams, map);
  return [...chrisTeamIds, ...frankyTeamIds].sort();
}

describe("Die Narbe verschwindet — und mit ihr der erfundene Spielmodus", () => {
  it("der gemeldete Fall: C-C faellt zurueck auf KI, S-C bleibt", () => {
    const { gameState, geheilteTeamIds } = heileFalschAlsMenschMarkierteTeams(spielstand({}));
    expect(geheilteTeamIds).toEqual(["C-C"]);
    expect(meineTeams(gameState)).toEqual(["S-C"]);
  });

  it("und der Spielmodus faellt von solo_2 auf solo_1 zurueck", () => {
    // DAS ist der Kern von „ich bekomme das nicht weg": der Modus haengt an der Anzahl, die
    // Anzahl an der Narbe. Erst wenn die Narbe weg ist, stimmt auch der Modus wieder.
    const vorher = spielstand({});
    expect(resolveGameModeFromState(vorher)).toBe("solo_2");
    expect(resolveGameModeFromState(heileFalschAlsMenschMarkierteTeams(vorher).gameState)).toBe("solo_1");
  });

  it("das GEWAEHLTE Team wird nie geheilt — auch nicht mit Etikett AI", () => {
    // `n90y4m`: dort ist C-C das echte Spielerteam. Ohne diesen Riegel loeschte die Heilung ein
    // echtes Team, nur weil sein Etikett nie umgeschrieben wurde.
    const { gameState, geheilteTeamIds } = heileFalschAlsMenschMarkierteTeams(
      spielstand({ gewaehlt: "C-C" }),
    );
    expect(geheilteTeamIds).toEqual([]);
    expect(meineTeams(gameState)).toEqual(["C-C", "S-C"]);
  });

  it("ein Team mit echtem Etikett bleibt meins", () => {
    // Zweiter Riegel: wer im Koop wirklich ein zweites Team fuehrt, traegt dort einen Namen.
    const { geheilteTeamIds } = heileFalschAlsMenschMarkierteTeams(spielstand({ narbeEtikett: "Franky" }));
    expect(geheilteTeamIds).toEqual([]);
  });

  it("ein KI-Team mit Etikett AI wird nicht angefasst — es ist ja schon KI", () => {
    const { gameState, geheilteTeamIds } = heileFalschAlsMenschMarkierteTeams(
      spielstand({ narbeModus: "ai" }),
    );
    expect(geheilteTeamIds).toEqual([]);
    expect(meineTeams(gameState)).toEqual(["S-C"]);
  });

  it("die Heilung laesst NIE einen Spielstand ohne eigenes Team zurueck", () => {
    /**
     * Der Randfall, an dem eine naive Fassung Schaden anrichtet: kein gewaehltes Team, und das
     * EINZIGE manuelle Team traegt „AI". Lieber die Narbe behalten als einen Spielstand, in dem
     * die KI alle 32 Teams steuert — genau der Zustand, ueber den Chris frueher schon einmal
     * gestolpert ist („ich waehle dort ein team aus aber dann wird fuer mich gepickt").
     */
    const nurNarbe = {
      ...spielstand({ gewaehlt: null }),
      seasonState: {
        newGameFlow: { selectedTeamId: null },
        teamControlSettings: {
          "S-C": { teamId: "S-C", controlMode: "ai", ownerId: "ai", ownerSlot: "ai", displayLabel: "AI" },
          "C-C": { teamId: "C-C", controlMode: "manual", ownerId: "user_local", ownerSlot: "user", displayLabel: "AI" },
          "M-M": { teamId: "M-M", controlMode: "ai", ownerId: "ai", ownerSlot: "ai", displayLabel: "AI" },
        },
      },
    } as unknown as GameState;

    const { gameState, geheilteTeamIds } = heileFalschAlsMenschMarkierteTeams(nurNarbe);
    expect(geheilteTeamIds).toEqual([]);
    expect(meineTeams(gameState)).toEqual(["C-C"]);
  });

  it("ohne Narbe kommt derselbe Spielstand zurueck — kein Umschreiben auf Verdacht", () => {
    const sauber = spielstand({ narbeEtikett: "Franky" });
    expect(heileFalschAlsMenschMarkierteTeams(sauber).gameState).toBe(sauber);
  });
});

describe("Sie laeuft auf dem Ladepfad, nicht in einem Skript", () => {
  it("`withNormalizedTeamControlSettings` heilt mit", () => {
    /**
     * Der Normalisierer haengt an `withNormalizedLocalTeamSettings`
     * (app/api/singleplayer-state/route.ts) und laeuft damit bei JEDEM Laden. Bestehende
     * Spielstaende heilen sich so beim naechsten Oeffnen selbst — Chris kommt an den Server nicht
     * heran, ein Reparaturskript haette ihn nicht erreicht.
     */
    const normalisiert = withNormalizedTeamControlSettings(spielstand({}));
    expect(meineTeams(normalisiert)).toEqual(["S-C"]);
    expect(normalisiert.teams.find((entry) => entry.teamId === "C-C")?.humanControlled).toBe(false);
    expect(normalisiert.teams.find((entry) => entry.teamId === "S-C")?.humanControlled).toBe(true);
  });
});
