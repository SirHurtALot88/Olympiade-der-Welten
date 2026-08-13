import { describe, expect, it } from "vitest";

import type { GameState, Player, Team } from "@/lib/data/olyDataTypes";
import { buildGameFlowState, type GameFlowStep } from "@/lib/foundation/game-flow-controller";
import {
  canAcknowledgeFlowStep,
  resolveGameFlowActionStep,
} from "@/lib/foundation/resolve-game-flow-action-step";

/**
 * GEMELDET VON CHRIS: „der season flow -> leertaste haengt bei gebaeude pruefen optional fest! wenn
 * man da drauf klickt muesste schon das naechste kommen weils ja optional ist statt stehen zu
 * bleiben."
 *
 * Getestet wird das VERHALTEN der Leertaste: die Schrittfolge, die mehrmaliges „Weiter" erzeugt.
 * Die Simulation unten ist derselbe Ablauf wie in der Oberflaeche — Auswahl des Aktionsschritts
 * (`use-foundation-cross-tab-game-flow`, gameFlowActionStep) und Quittierung beim Ausloesen
 * (`triggerGlobalNext`). Der Spielstand aendert sich dabei NICHT: wer einen Schritt nur anschaut,
 * aendert nichts am Save — genau deshalb faellt ein nicht quittierbarer Schritt in die Endlosschleife.
 */

function team(partial?: Partial<Team>): Team {
  return {
    teamId: partial?.teamId ?? "M-M",
    shortCode: partial?.shortCode ?? "M-M",
    name: partial?.name ?? "Mayhem Mavericks",
    budget: partial?.budget ?? 500,
    cash: partial?.cash ?? 300,
    identityId: partial?.identityId ?? "M-M",
    humanControlled: partial?.humanControlled ?? true,
    rosterLimit: partial?.rosterLimit ?? 12,
    logoPath: partial?.logoPath ?? null,
  };
}

function player(id: string): Player {
  return {
    id,
    name: id,
    rating: 50,
    marketValue: 10,
    salaryDemand: 2,
    pps: null,
    ovr: null,
    className: "Runner",
    race: "Human",
    alignment: "neutral",
    gender: "n/a",
    subclasses: [],
    traitsPositive: [],
    traitsNegative: [],
    coreStats: { pow: 40, spe: 40, men: 40, soc: 40 },
    preferredDisciplineIds: [],
    disciplineRatings: {},
    disciplineTierCounts: { above20: 0, above40: 0, above60: 0, above80: 0 },
    flavorEn: "",
    flavorDe: "",
    fatigue: 0,
    form: 0,
    potential: 0,
    trainingMode: "mittel",
  };
}

function gameState(partial?: Partial<GameState>): GameState {
  const teams = partial?.teams ?? [team()];
  const players = partial?.players ?? [player("p-1")];
  return {
    gamePhase: "season_active",
    season: { id: "season-2", name: "Season 2", year: 2027, currentMatchday: 1, matchdayIds: ["season-2-md-1"] },
    seasonState: {
      seasonId: "season-2",
      schedule: [],
      standings: {},
      ...(partial?.seasonState ?? {}),
    },
    matchdayState: {
      matchdayId: "season-2-md-1",
      status: "planning",
      pendingTeamIds: [],
      resolvedFixtureIds: [],
      ...(partial?.matchdayState ?? {}),
    },
    teams,
    teamIdentities: [],
    players,
    disciplines: [],
    rosters: partial?.rosters ?? [
      {
        id: "r-1",
        teamId: "M-M",
        playerId: "p-1",
        contractLength: 1,
        salary: 2,
        upkeep: 2,
        purchasePrice: 10,
        currentValue: 10,
        roleTag: "starter",
        joinedSeasonId: "season-2",
      },
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
    ...partial,
  };
}

/** Spieltag gespielt und vollstaendig gewertet — der Zustand, in dem Chris haengen blieb. */
function playedMatchdayState(): GameState {
  return gameState({
    seasonState: {
      seasonId: "season-2",
      schedule: [],
      standings: {},
      // Pool vorhanden = „Transfers finalisiert" (form-card-flow).
      formCards: [{ cardId: "fc-1", seasonId: "season-2", teamId: "M-M", modifierId: "mod-1", used: false }],
      lineupDrafts: [
        {
          seasonId: "season-2",
          matchdayId: "season-2-md-1",
          teamId: "M-M",
          status: "resolved",
          entries: [{ playerId: "p-1", disciplineSide: "d1", slotIndex: 0 }],
        },
      ],
    } as unknown as GameState["seasonState"],
    matchdayState: {
      matchdayId: "season-2-md-1",
      status: "resolved",
      pendingTeamIds: [],
      resolvedFixtureIds: [],
    },
  });
}

/**
 * Ein Druck auf „Weiter"/Leertaste: Aktionsschritt bestimmen und quittieren.
 * Spiegelt `gameFlowActionStep` + `triggerGlobalNext` aus der Shell.
 */
function pressWeiter(state: GameState, acknowledged: Set<string>): GameFlowStep {
  const flow = buildGameFlowState({ gameState: state, activeTeamId: "M-M" });
  const actionableSteps = flow.steps.filter(
    (entry) => entry.status !== "completed" && !(entry.status !== "blocked" && acknowledged.has(entry.stepId)),
  );
  const fallbackStep =
    flow.currentStep.status === "completed" ? (flow.nextStep ?? flow.currentStep) : flow.currentStep;
  const actionStep = resolveGameFlowActionStep(actionableSteps, fallbackStep, acknowledged);
  if (canAcknowledgeFlowStep(actionStep)) {
    acknowledged.add(actionStep.stepId);
  }
  return actionStep;
}

function pressWeiterRepeatedly(state: GameState, presses: number) {
  const acknowledged = new Set<string>();
  const sequence: string[] = [];
  for (let index = 0; index < presses; index += 1) {
    sequence.push(pressWeiter(state, acknowledged).stepId);
  }
  return sequence;
}

describe("optionale Flow-Schritte blockieren die Weiter-Aktion nicht", () => {
  it("fuehrt nach dem Spieltag ueber die Gebaeude-Frage hinweg zum Spieltagswechsel", () => {
    const sequence = pressWeiterRepeatedly(playedMatchdayState(), 6);

    // Der Gebaeude-Schritt darf genau EINMAL angeboten werden — danach geht es weiter.
    expect(sequence.filter((stepId) => stepId === "matchday_facilities")).toHaveLength(1);
    const facilitiesIndex = sequence.indexOf("matchday_facilities");
    expect(facilitiesIndex).toBeGreaterThanOrEqual(0);
    expect(sequence[facilitiesIndex + 1]).toBe("advance_to_next_matchday");
    expect(sequence.at(-1)).toBe("advance_to_next_matchday");
  });

  it("laesst den quittierten Gebaeude-Schritt im Flow stehen", () => {
    const state = playedMatchdayState();
    const acknowledged = new Set<string>();
    for (let index = 0; index < 4; index += 1) {
      pressWeiter(state, acknowledged);
    }

    // Quittiert heisst gesehen, nicht erledigt und schon gar nicht verschwunden:
    // der Schritt bleibt sichtbar und ueber die Navigation erreichbar.
    const flow = buildGameFlowState({ gameState: state, activeTeamId: "M-M" });
    const facilities = flow.steps.find((entry) => entry.stepId === "matchday_facilities");
    expect(facilities?.status).toBe("optional");
    expect(acknowledged.has("matchday_facilities")).toBe(true);
  });

  it("macht jeden optionalen Schritt beider Flows quittierbar", () => {
    const matchdayFlow = buildGameFlowState({ gameState: playedMatchdayState(), activeTeamId: "M-M" });
    const preseasonFlow = buildGameFlowState({
      gameState: gameState({
        gamePhase: "next_season_ready",
        seasonState: {
          seasonId: "season-2",
          schedule: [],
          standings: {},
          seasonSnapshots: [{ seasonId: "season-1" }],
        } as unknown as GameState["seasonState"],
      }),
      activeTeamId: "M-M",
    });

    const optionalSteps = [...matchdayFlow.steps, ...preseasonFlow.steps].filter(
      (entry) => entry.status === "optional",
    );
    // Sicherung gegen einen leeren Durchlauf: die Faelle, um die es geht, muessen vorkommen.
    expect(optionalSteps.map((entry) => entry.stepId)).toEqual(
      expect.arrayContaining(["matchday_facilities", "facilities", "sell_players"]),
    );
    for (const optionalStep of optionalSteps) {
      expect(canAcknowledgeFlowStep(optionalStep), optionalStep.stepId).toBe(true);
    }
  });

  it("laesst Arbeits-Schritte weiterhin nicht wegdruecken", () => {
    // Kader aufbauen, Aufstellung, Transfers finalisieren: hier gibt es etwas zu TUN.
    // Sie duerfen nicht durch blosses Weiterdruecken aus der Fuehrung fallen.
    for (const stepId of ["buy_players", "set_lineup", "finalize_transfers", "check_training"]) {
      expect(canAcknowledgeFlowStep({ stepId, status: "ready" }), stepId).toBe(false);
      expect(canAcknowledgeFlowStep({ stepId, status: "warning" }), stepId).toBe(false);
    }
  });
});
