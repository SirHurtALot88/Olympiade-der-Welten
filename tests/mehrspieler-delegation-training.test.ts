import { describe, expect, it, vi } from "vitest";

import { reevaluateAiTrainingModesForMatchday } from "@/lib/ai/ai-training-mode-reevaluation-service";
import { RAMONA_OWNER_ID } from "@/lib/foundation/team-control-settings";
import { resolveTeamDelegation, withTrainingSelbstSpieler } from "@/lib/foundation/team-delegation";
import type {
  GameState,
  Player,
  Team,
  TeamControlSettings,
  TeamIdentity,
} from "@/lib/data/olyDataTypes";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";

/**
 * MEHRSPIELER-DELEGATION, Training (Chris, 18.11.): „Entwicklung stellt die KI ein, aber man kann
 * sie quasi manuell überschreiben, wenn man möchte.“ — Halbautomatik: die KI setzt Trainingsmodus
 * (und fehlende Trainingsklasse) je Spieltag; was der Mensch selbst gesetzt hat, bleibt, bis er den
 * Spieler zurueck auf KI stellt.
 *
 * Die Fixture ist die aus tests/ai-training-mode-reevaluation-service.test.ts (KI-Team T-AI,
 * menschliches Team T-HUM, beide muede).
 */

function buildPlayer(id: string, teamHint: string, overrides: Partial<Player> = {}): Player {
  return {
    id,
    name: id,
    rating: 70,
    marketValue: 20,
    salaryDemand: 5,
    displayMarketValue: 20,
    displaySalary: 5,
    className: "Hero",
    race: "Human",
    alignment: "neutral",
    gender: "m",
    subclasses: [],
    traitsPositive: [],
    traitsNegative: [],
    coreStats: { pow: 70, spe: 70, men: 70, soc: 70 },
    preferredDisciplineIds: [],
    disciplineRatings: { tdm: 80, "mini-dm": 75 },
    disciplineTierCounts: { above20: 1, above40: 1, above60: 1, above80: 0 },
    flavorEn: "",
    flavorDe: "",
    fatigue: 25,
    form: 50,
    potential: 80,
    trainingMode: "mittel",
    ...overrides,
    // teamHint keeps the id namespaced per team without leaking into Player.
  } as Player;
}

function controlSettings(teamId: string, controlMode: "ai" | "manual"): TeamControlSettings {
  return {
    teamId,
    controlMode,
    ownerId: controlMode === "ai" ? "ai" : "user_local",
    ownerSlot: controlMode === "ai" ? "ai" : "user",
    displayLabel: teamId,
    aiLineupPreviewEnabled: controlMode === "ai",
    aiLineupApplyEnabled: false,
    aiLineupAutoApplyEnabled: false,
    aiTransferPreviewEnabled: controlMode === "ai",
    aiTransferAutoApplyEnabled: false,
    aiSellPreviewEnabled: controlMode === "ai",
    aiSellAutoApplyEnabled: false,
    notes: null,
    strategyLock: null,
  };
}

function buildTeam(teamId: string, humanControlled: boolean): Team {
  return {
    teamId,
    shortCode: teamId,
    name: teamId,
    budget: 50,
    cash: 50,
    identityId: `${teamId}-I`,
    humanControlled,
    rosterLimit: 30,
    rosterMinTarget: 4,
    rosterOptTarget: 6,
  } as Team;
}

function buildIdentity(teamId: string): TeamIdentity {
  return {
    teamId,
    playerType: "balanced",
    pow: 70,
    spe: 60,
    men: 60,
    soc: 50,
    ambition: 75,
    finances: 60,
    boardConfidence: 60,
    harmony: 60,
    manners: 60,
    popularity: 60,
    cooperation: 60,
    playerMin: 4,
    playerOpt: 6,
  } as TeamIdentity;
}

function facilitiesFor(teamIds: string[]) {
  return Object.fromEntries(
    teamIds.map((teamId) => [
      teamId,
      {
        facilities: {
          training_center: { level: 1, enabled: true },
          recovery_center: { level: 0, enabled: false },
          scouting_office: { level: 0, enabled: false },
          analytics_room: { level: 0, enabled: false },
          fan_shop: { level: 0, enabled: false },
          arena_upgrade: { level: 0, enabled: false },
          academy: { level: 0, enabled: false },
          specialist_wing: { level: 0, enabled: false },
        },
      },
    ]),
  );
}

/** AI team (T-AI) with `aiCount` fatigued players; manual team (T-HUM) with `humCount`. */
function buildSave(input: { aiCount: number; humCount: number; fatigue: number }): PersistedSaveGame {
  const aiPlayers = Array.from({ length: input.aiCount }, (_, index) =>
    buildPlayer(`ai-${index}`, "T-AI", { rating: 84, fatigue: input.fatigue, disciplineRatings: { tdm: 84 } }),
  );
  const humPlayers = Array.from({ length: input.humCount }, (_, index) =>
    buildPlayer(`hum-${index}`, "T-HUM", { rating: 84, fatigue: input.fatigue, disciplineRatings: { tdm: 84 } }),
  );
  const players = [...aiPlayers, ...humPlayers];
  const teamOf = (playerId: string) => (playerId.startsWith("ai-") ? "T-AI" : "T-HUM");

  const gameState = {
    gamePhase: "season_active",
    season: {
      id: "season-1",
      name: "Season 1",
      year: 1,
      currentMatchday: 5,
      matchdayIds: Array.from({ length: 10 }, (_, index) => `matchday-${index + 1}`),
      totalMatchdays: 10,
    },
    seasonState: {
      seasonId: "season-1",
      schedule: [],
      disciplineSchedule: [
        { matchdayId: "matchday-5", matchdayIndex: 5, seasonId: "season-1", discipline1: null, discipline2: null },
      ],
      standings: {},
      teamControlSettings: {
        "T-AI": controlSettings("T-AI", "ai"),
        "T-HUM": controlSettings("T-HUM", "manual"),
      },
      aiManagerTrainingSettings: {
        "T-AI": { teamId: "T-AI", seasonId: "season-1", trainingIntensity: "normal" },
        "T-HUM": { teamId: "T-HUM", seasonId: "season-1", trainingIntensity: "normal" },
      },
      playerDisciplinePerformances: players.flatMap((player) =>
        Array.from({ length: 4 }, (_, index) => ({
          id: `${player.id}-${index}`,
          playerId: player.id,
          teamId: teamOf(player.id),
          matchdayResultId: `result-${index}`,
          disciplineId: "tdm",
          scoreContribution: 4,
          finalPlayerScore: 70,
          isTop10: false,
          isMvpCandidate: false,
        })),
      ),
      teamFacilities: facilitiesFor(["T-AI", "T-HUM"]),
    },
    matchdayState: {
      matchdayId: "matchday-5",
      status: "planning",
      pendingTeamIds: [],
      resolvedFixtureIds: [],
    },
    teams: [buildTeam("T-AI", false), buildTeam("T-HUM", true)],
    teamIdentities: [buildIdentity("T-AI"), buildIdentity("T-HUM")],
    players,
    disciplines: [{ id: "tdm", name: "TDM", category: "power", weight: 1 }],
    rosters: players.map((player, index) => ({
      id: `r-${index}`,
      teamId: teamOf(player.id),
      playerId: player.id,
      contractLength: 2,
      salary: 5,
      upkeep: 5,
      roleTag: "starter",
      joinedSeasonId: "season-1",
    })),
    contracts: [],
    transferListings: [],
    transferHistory: [],
    playerMoraleState: [],
    logs: [],
    mappingReport: {
      mappingSource: "",
      teamSource: "",
      generatedAt: "",
      processedMappingRows: 0,
      importedPlayerCount: 0,
      matchedRosterCount: 0,
      teamCount: 2,
      unmappedPlayers: [],
      teamsWithoutPlayers: [],
      mappingRowsWithoutPlayerMatch: [],
      duplicateMappedPlayers: [],
      unknownTeamCodes: [],
      duplicateTeamCodes: [],
      warnings: [],
    },
  } as unknown as GameState;

  return {
    saveId: "save-1",
    status: "active",
    updatedAt: new Date().toISOString(),
    gameState,
  } as unknown as PersistedSaveGame;
}

function persistenceMock(initial: PersistedSaveGame) {
  let current = initial;
  const saveSingleplayerState = vi.fn((saveId: string, nextGameState: GameState) => {
    current = { ...current, saveId, gameState: nextGameState };
    return current;
  });
  return {
    persistence: {
      saveSingleplayerState,
      getSaveById: vi.fn(() => current),
      getActiveSave: vi.fn(() => current),
      bootstrapSingleplayerSave: vi.fn(() => ({ save: current, createdFromSeed: false })),
    } as unknown as PersistenceService,
    get current() {
      return current;
    },
    saveSingleplayerState,
  };
}


function withHumanDelegation(save: PersistedSaveGame, settings: Partial<TeamControlSettings>): PersistedSaveGame {
  const current = save.gameState.seasonState.teamControlSettings!["T-HUM"]!;
  save.gameState.seasonState.teamControlSettings = {
    ...save.gameState.seasonState.teamControlSettings,
    "T-HUM": { ...current, ...settings },
  };
  return save;
}

describe("Mehrspieler-Delegation: Training", () => {
  it("ohne Delegation bleibt ein menschliches Team unberuehrt (Verhalten wie vor dem 18.11.)", () => {
    const mock = persistenceMock(buildSave({ aiCount: 12, humCount: 4, fatigue: 82 }));
    const result = reevaluateAiTrainingModesForMatchday({ saveId: "save-1", persistence: mock.persistence });
    expect(result.skippedManual).toBe(1);
    expect(result.delegatedTeamsEvaluated).toBe(0);
    expect(mock.current.gameState.players.filter((p) => p.id.startsWith("hum-")).every((p) => p.trainingMode === "mittel")).toBe(true);
  });

  it("Ramonas Team (Halbautomatik ohne gespeichertes Feld) wird wie ein KI-Team bewertet", () => {
    const save = withHumanDelegation(buildSave({ aiCount: 4, humCount: 12, fatigue: 82 }), {
      ownerId: RAMONA_OWNER_ID,
      ownerSlot: RAMONA_OWNER_ID,
    });
    const mock = persistenceMock(save);
    const result = reevaluateAiTrainingModesForMatchday({ saveId: "save-1", persistence: mock.persistence });

    expect(result.skippedManual).toBe(0);
    expect(result.delegatedTeamsEvaluated).toBe(1);
    const humLeicht = mock.current.gameState.players.filter((p) => p.id.startsWith("hum-") && p.trainingMode === "leicht");
    expect(humLeicht.length).toBeGreaterThan(0);
    // Fehlende Trainingsklassen setzt die KI einmal (Fixture: keiner hat eine).
    expect(mock.current.gameState.players.filter((p) => p.id.startsWith("hum-")).every((p) => Boolean(p.trainingClass))).toBe(true);
  });

  it("selbst gesetzte Spieler fasst die KI nicht an, bis sie zurueck auf KI gestellt werden", () => {
    const base = buildSave({ aiCount: 4, humCount: 12, fatigue: 82 });
    const settings = base.gameState.seasonState.teamControlSettings!["T-HUM"]!;
    const halb = { ...settings, ownerId: RAMONA_OWNER_ID, ownerSlot: RAMONA_OWNER_ID };
    // Ramona stellt zwei Spieler selbst auf „hart“ — genau wie /api/training es vermerkt.
    let delegation = withTrainingSelbstSpieler(halb, "hum-0", true);
    delegation = withTrainingSelbstSpieler({ ...halb, delegation }, "hum-1", true);
    expect(resolveTeamDelegation({ ...halb, delegation }).trainingSelbstSpielerIds).toEqual(["hum-0", "hum-1"]);
    base.gameState.players = base.gameState.players.map((p) =>
      p.id === "hum-0" || p.id === "hum-1" ? { ...p, trainingMode: "hart", trainingClass: "Berserker" } : p,
    );
    const mock = persistenceMock(withHumanDelegation(base, { ...halb, delegation }));

    const result = reevaluateAiTrainingModesForMatchday({ saveId: "save-1", persistence: mock.persistence });
    expect(result.delegatedPlayersRespected).toBe(2);
    const byId = new Map(mock.current.gameState.players.map((p) => [p.id, p] as const));
    expect(byId.get("hum-0")?.trainingMode).toBe("hart");
    expect(byId.get("hum-1")?.trainingMode).toBe("hart");
    expect(byId.get("hum-0")?.trainingClass).toBe("Berserker");
    // Die uebrigen (muede) setzt die KI.
    expect(mock.current.gameState.players.filter((p) => p.id.startsWith("hum-") && p.trainingMode === "leicht").length).toBeGreaterThan(0);

    // Zurueck auf KI: ab dem naechsten Spieltag entscheidet wieder die KI.
    const zurueck = withTrainingSelbstSpieler({ ...halb, delegation }, "hum-0", false);
    expect(zurueck.trainingSelbstSpielerIds).toEqual(["hum-1"]);
  });

  it("Einzelschalter: Halbautomatik mit Training selbst laesst das Training in Ruhe", () => {
    const save = withHumanDelegation(buildSave({ aiCount: 4, humCount: 12, fatigue: 82 }), {
      ownerId: RAMONA_OWNER_ID,
      ownerSlot: RAMONA_OWNER_ID,
      delegation: { stufe: "halbautomatik", bereiche: { training: "selbst" } },
    });
    const mock = persistenceMock(save);
    const result = reevaluateAiTrainingModesForMatchday({ saveId: "save-1", persistence: mock.persistence });
    expect(result.delegatedTeamsEvaluated).toBe(0);
    expect(result.skippedManual).toBe(1);
    expect(mock.current.gameState.players.filter((p) => p.id.startsWith("hum-")).every((p) => p.trainingMode === "mittel")).toBe(true);
  });
});
