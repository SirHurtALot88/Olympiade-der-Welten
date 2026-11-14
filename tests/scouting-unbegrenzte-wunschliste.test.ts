/**
 * Chris, 10.11.: „erweiter bitte das Scouting, dass dort endlos viele Spieler für ein team
 * gespeichert werden dürfen, es wird aber weiterhin dann nur die obersten X der liste gescoutet
 * bis die vollständig gescoutet sind."
 *
 * Geprüft wird die Entkopplung: Liste unbegrenzt, aktive Queue = die obersten X NICHT fertigen
 * Einträge, Fortschritt außerhalb der Queue bleibt erhalten (geparkt) und tickt nicht.
 * Konzept: docs/design/scouting-ausbau-konzept-11-11.md, Abschnitt 4.
 */
import { describe, expect, it } from "vitest";

import type { GameState, PlayerScoutIntelRecord } from "@/lib/data/olyDataTypes";
import {
  advanceScoutIntelTick,
  buildScoutPipelineSummary,
  getFocusScoutTarget,
  refreshScoutPipeline,
} from "@/lib/scouting/facility-scout-pipeline-service";
import {
  canAddManualScoutingWatchEntry,
  canAddPlayerToTransferWishlist,
  getActiveScoutingWishlistEntries,
  getScoutingWishlistQueue,
  getScoutingWishlistSlotsForLevel,
  reorderTeamTransferWishlist,
  splitScoutingWishlistQueue,
} from "@/lib/scouting/scouting-wishlist-slots";

const TEAM = "M-M";

function createGameState(input: { scoutingLevel: number; wishlistSize: number; records?: PlayerScoutIntelRecord[] }): GameState {
  const wishlist = Array.from({ length: input.wishlistSize }, (_, index) => ({
    id: `w-${index + 1}`,
    saveId: "save",
    seasonId: "season-2",
    teamId: TEAM,
    playerId: `p-${index + 1}`,
    playerName: `p-${index + 1}`,
    className: "Hero",
    race: "Human",
    marketValue: 10,
    salary: 2,
    bracket: null,
    createdAt: `2026-06-25T00:00:${String(index % 60).padStart(2, "0")}.000Z`,
    priorityRank: index,
  }));
  const rosterIds = Array.from({ length: 10 }, (_, index) => `roster-${index}`);
  const playerIds = [...wishlist.map((entry) => entry.playerId), ...rosterIds];
  return {
    gamePhase: "season_active",
    season: { id: "season-2", name: "Season 2", year: 2, currentMatchday: 1, matchdayIds: ["md-1"] },
    seasonState: {
      seasonId: "season-2",
      schedule: [],
      standings: {},
      transferWishlist: wishlist,
      scoutIntelByTeamId: input.records ? { [TEAM]: input.records } : undefined,
      teamFacilities: { [TEAM]: { facilities: { scouting_office: { level: input.scoutingLevel, enabled: true } } } },
    },
    matchdayState: { matchdayId: "md-1", status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams: [{ teamId: TEAM, name: "Mayhem", shortCode: TEAM, budget: 100, cash: 50, identityId: TEAM, humanControlled: true, rosterLimit: 14 }],
    teamIdentities: [{ teamId: TEAM, playerMin: 7, playerOpt: 10, pow: 5, spe: 5, men: 5, soc: 5, ambition: 5, finances: 5, boardConfidence: 5, harmony: 5, manners: 5, popularity: 5, cooperation: 5, playerType: null }],
    players: playerIds.map((playerId) => ({
      id: playerId,
      name: playerId,
      rating: 60,
      marketValue: 10,
      salaryDemand: 2,
      className: "Hero",
      race: "Human",
      alignment: "N",
      gender: "x",
      subclasses: [],
      traitsPositive: [],
      traitsNegative: [],
      coreStats: { pow: 50, spe: 50, men: 50, soc: 50 },
      preferredDisciplineIds: [],
      disciplineRatings: {},
      disciplineTierCounts: { above20: 0, above40: 0, above60: 0, above80: 0 },
      flavorEn: "",
      flavorDe: "",
      fatigue: 0,
      form: 0,
      potential: 70,
      trainingMode: null,
    })),
    rosters: rosterIds.map((playerId) => ({
      id: playerId,
      teamId: TEAM,
      playerId,
      contractLength: 1,
      salary: 2,
      upkeep: 2,
      purchasePrice: 10,
      currentValue: 10,
      roleTag: "starter",
      joinedSeasonId: "season-2",
    })),
    contracts: [],
    transferListings: [],
    transferHistory: [],
    logs: [],
    disciplines: [],
  } as unknown as GameState;
}

function record(playerId: string, certainty: number): PlayerScoutIntelRecord {
  return {
    playerId,
    teamId: TEAM,
    seasonId: "season-2",
    source: "wishlist_mirror",
    certainty,
    startedAt: "2026-06-25T00:00:00.000Z",
    lastTickAt: null,
    ticksCompleted: 0,
  };
}

function teamRecords(state: GameState) {
  return state.seasonState.scoutIntelByTeamId?.[TEAM] ?? [];
}

const ids = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, index) => `p-${from + index}`);

describe("unbegrenzte Wunschliste, begrenzte aktive Scouting-Queue", () => {
  // Bürostufe 1: 10 aktive Plätze, voll gescoutet ab Certainty 100 (Level 1 + 100/25 = 5).
  const X = getScoutingWishlistSlotsForLevel(1);

  it("nimmt beliebig viele Einträge an, aktiv sind nur die obersten X", () => {
    const state = createGameState({ scoutingLevel: 1, wishlistSize: 40 });
    expect(canAddPlayerToTransferWishlist(state, TEAM, "p-41").ok).toBe(true);
    const queue = getScoutingWishlistQueue(state, TEAM);
    expect(queue.ordered).toHaveLength(40);
    expect(queue.active.map((entry) => entry.playerId)).toEqual(ids(1, X));
    expect(queue.waiting).toHaveLength(40 - X);
    expect(queue.completed).toHaveLength(0);
  });

  it("ein fertig gescouteter Eintrag gibt seinen Slot an den nächsten wartenden ab", () => {
    const state = createGameState({ scoutingLevel: 1, wishlistSize: 40, records: [record("p-1", 100)] });
    const queue = getScoutingWishlistQueue(state, TEAM);
    expect(queue.completed.map((entry) => entry.playerId)).toEqual(["p-1"]);
    expect(queue.active.map((entry) => entry.playerId)).toEqual(ids(2, X + 1));
    expect(queue.stateByPlayerId.get(`p-${X + 2}`)).toBe("waiting");
  });

  it("folgt der Priorität: wer nach oben sortiert wird, verdrängt den untersten Aktiven", () => {
    const state = createGameState({ scoutingLevel: 1, wishlistSize: 40 });
    const reordered = reorderTeamTransferWishlist(state.seasonState.transferWishlist ?? [], TEAM, "p-30", 0);
    const next = { ...state, seasonState: { ...state.seasonState, transferWishlist: reordered } };
    const active = getActiveScoutingWishlistEntries(next, TEAM).map((entry) => entry.playerId);
    expect(active[0]).toBe("p-30");
    expect(active).toHaveLength(X);
    expect(active).not.toContain(`p-${X}`);
  });

  it("parkt den Fortschritt fertiger Einträge: kein Slot, kein Tick, kein Zurückfallen auf 0", () => {
    const state = createGameState({ scoutingLevel: 1, wishlistSize: 40, records: [record("p-1", 100)] });
    const refreshed = refreshScoutPipeline(state, TEAM);
    const parked = teamRecords(refreshed).find((entry) => entry.playerId === "p-1");
    expect(parked).toMatchObject({ certainty: 100, parked: true });

    const summary = buildScoutPipelineSummary(refreshed, TEAM);
    expect(summary.occupiedSlots).toBe(X);
    expect(summary.activeRecords.map((entry) => entry.playerId)).toEqual(ids(2, X + 1));

    // Zweiter Refresh: p-1 bleibt fertig und geparkt — kein Pendeln zurück in die Queue.
    const again = refreshScoutPipeline(refreshed, TEAM);
    expect(getScoutingWishlistQueue(again, TEAM).completed.map((entry) => entry.playerId)).toEqual(["p-1"]);

    const ticked = advanceScoutIntelTick({ gameState: refreshed, teamId: TEAM, phase: "matchday" });
    const afterTick = teamRecords(ticked).find((entry) => entry.playerId === "p-1");
    expect(afterTick).toMatchObject({ certainty: 100, ticksCompleted: 0, parked: true });
    // Der Fokus springt auf den ersten noch nicht fertigen Eintrag.
    expect(getFocusScoutTarget(ticked, TEAM)?.playerId).toBe("p-2");
  });

  it("wer unter die aktiven Plätze sortiert wird, behält seinen Teilfortschritt und macht später weiter", () => {
    const state = refreshScoutPipeline(createGameState({ scoutingLevel: 1, wishlistSize: 20, records: [record("p-3", 40)] }), TEAM);
    const down = reorderTeamTransferWishlist(state.seasonState.transferWishlist ?? [], TEAM, "p-3", 19);
    let next = refreshScoutPipeline({ ...state, seasonState: { ...state.seasonState, transferWishlist: down } }, TEAM);
    expect(teamRecords(next).find((entry) => entry.playerId === "p-3")).toMatchObject({ certainty: 40, parked: true });

    next = advanceScoutIntelTick({ gameState: next, teamId: TEAM, phase: "matchday" });
    expect(teamRecords(next).find((entry) => entry.playerId === "p-3")?.certainty).toBe(40);

    const up = reorderTeamTransferWishlist(next.seasonState.transferWishlist ?? [], TEAM, "p-3", 0);
    next = refreshScoutPipeline({ ...next, seasonState: { ...next.seasonState, transferWishlist: up } }, TEAM);
    const resumed = teamRecords(next).find((entry) => entry.playerId === "p-3");
    expect(resumed?.parked).toBeUndefined();
    expect(resumed?.certainty).toBe(40);
    next = advanceScoutIntelTick({ gameState: next, teamId: TEAM, phase: "matchday" });
    expect(teamRecords(next).find((entry) => entry.playerId === "p-3")?.certainty).toBeGreaterThan(40);
  });

  it("eine lange Merkliste sperrt manuelle Beobachtungen nicht aus — es zählen nur die aktiven Plätze", () => {
    const completedRecords = ids(1, 35).map((playerId) => record(playerId, 100));
    const state = createGameState({ scoutingLevel: 1, wishlistSize: 40, records: completedRecords });
    expect(getScoutingWishlistQueue(state, TEAM).active).toHaveLength(5);
    expect(canAddManualScoutingWatchEntry(state, TEAM).ok).toBe(true);
  });

  it("splitScoutingWishlistQueue ist rein: Kapazität 0 heißt alles wartet, Fertige zählen nie mit", () => {
    const entries = (createGameState({ scoutingLevel: 1, wishlistSize: 4 }).seasonState.transferWishlist ?? []);
    const none = splitScoutingWishlistQueue(entries, 0, () => false);
    expect(none.active).toHaveLength(0);
    expect(none.waiting).toHaveLength(4);
    const split = splitScoutingWishlistQueue(entries, 2, (playerId) => playerId === "p-1" || playerId === "p-2");
    expect(split.completed.map((entry) => entry.playerId)).toEqual(["p-1", "p-2"]);
    expect(split.active.map((entry) => entry.playerId)).toEqual(["p-3", "p-4"]);
    expect(split.waiting).toHaveLength(0);
  });
});
