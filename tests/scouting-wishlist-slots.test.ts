import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import {
  advanceScoutIntelTick,
  getEffectiveScoutingLevel,
  refreshScoutPipeline,
} from "@/lib/scouting/facility-scout-pipeline-service";
import {
  canAddPlayerToTransferWishlist,
  DRAFT_TRANSFER_WISHLIST_SLOT_LIMIT,
  getActiveScoutingWishlistEntries,
  getScoutingWishlistSlotLimit,
  getScoutingWishlistSlotsForLevel,
  isTeamSetupDraftWishlistPhase,
  trimTransferWishlistToSlotLimit,
} from "@/lib/scouting/scouting-wishlist-slots";

function createGameState(partial?: {
  scoutingLevel?: number;
  wishlist?: Array<{ playerId: string; createdAt: string; priorityRank?: number; teamId?: string }>;
  rosterCount?: number;
  seasonId?: string;
  gamePhase?: GameState["gamePhase"];
  // undefined = kein `newGameFlow` im State (Alt-Save-Fallback über Kaderstand,
  // siehe isTeamSetupDraftWishlistPhase). true/false = expliziter Flow-Status,
  // wie ihn echte Season-1-Neustarts im Save mitführen.
  newGameFlowActive?: boolean;
}): GameState {
  const scoutingLevel = partial?.scoutingLevel ?? 1;
  const wishlist =
    partial?.wishlist?.map((entry, index) => ({
      id: `w-${index}`,
      saveId: "save",
      seasonId: partial?.seasonId ?? "season-2",
      teamId: entry.teamId ?? "M-M",
      playerId: entry.playerId,
      playerName: entry.playerId,
      className: "Hero",
      race: "Human",
      marketValue: 10,
      salary: 2,
      createdAt: entry.createdAt,
      priorityRank: entry.priorityRank,
    })) ?? [];

  const rosterCount = partial?.rosterCount ?? 0;
  const playerIds = new Set(wishlist.map((entry) => entry.playerId));
  for (let index = 0; index < rosterCount; index += 1) {
    playerIds.add(`roster-${index}`);
  }

  return {
    gamePhase: partial?.gamePhase ?? "preseason_management",
    season: { id: partial?.seasonId ?? "season-2", name: "Season 2", year: 2, currentMatchday: 1, matchdayIds: ["md-1"] },
    seasonState: {
      seasonId: partial?.seasonId ?? "season-2",
      schedule: [],
      standings: {},
      transferWishlist: wishlist,
      teamFacilities: {
        "M-M": {
          facilities: {
            scouting_office: { level: scoutingLevel, enabled: true },
          },
        },
      },
      newGameFlow:
        partial?.newGameFlowActive === undefined
          ? undefined
          : { active: partial.newGameFlowActive, steps: [] },
    },
    matchdayState: { matchdayId: "md-1", status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams: [{ teamId: "M-M", name: "Mayhem", shortCode: "M-M", budget: 100, cash: 50, identityId: "M-M", humanControlled: true, rosterLimit: 14 }],
    teamIdentities: [{ teamId: "M-M", playerMin: 7, playerOpt: 10, pow: 5, spe: 5, men: 5, soc: 5, ambition: 5, finances: 5, boardConfidence: 5, harmony: 5, manners: 5, popularity: 5, cooperation: 5, playerType: null }],
    players: [...playerIds].map((playerId) => ({
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
    rosters: Array.from({ length: rosterCount }, (_, index) => ({
      id: `roster-${index}`,
      teamId: "M-M",
      playerId: `roster-${index}`,
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
    mappingReport: {
      mappingSource: "test",
      teamSource: "test",
      generatedAt: "2026-06-25T00:00:00.000Z",
      processedMappingRows: 0,
      importedPlayerCount: 0,
      matchedRosterCount: 0,
      teamCount: 1,
      unmappedPlayers: [],
    },
    disciplines: [],
  } as GameState;
}

describe("scouting wishlist slots", () => {
  it("gibt 6 Grundplaetze plus 4 je Scouting-Stufe", () => {
    // Chris: „erweiter die wunschliste mal um 2 slots + mehr slots mit den gebäudeupgrades pro
    // stufe." Vorher 4 + 3 je Stufe (4 bis 19 Plaetze), jetzt 6 + 4 (6 bis 26).
    //
    // Die Zahlen stehen hier ABSICHTLICH ausgeschrieben statt aus den Konstanten gerechnet: sie
    // sind eine Balancing-Entscheidung, keine Ableitung. Wer sie aendert, soll das hier sehen und
    // nicht durch eine Formel hindurch, die sich stillschweigend mitzieht.
    expect(getScoutingWishlistSlotsForLevel(0)).toBe(6);
    expect(getScoutingWishlistSlotsForLevel(1)).toBe(10);
    expect(getScoutingWishlistSlotsForLevel(3)).toBe(18);
    expect(getScoutingWishlistSlotsForLevel(5)).toBe(26);
    expect(getScoutingWishlistSlotLimit(createGameState({ scoutingLevel: 0 }), "M-M")).toBe(6);
    expect(getScoutingWishlistSlotLimit(createGameState({ scoutingLevel: 3 }), "M-M")).toBe(18);
  });

  it("macht jede Ausbaustufe wertvoll, aber die spaeteren teurer je Platz", () => {
    // Die Staffelung ist an den Baukosten des Scouting-Bueros gemessen (kumuliert 6/18/38/70/120 C).
    // Jede Stufe gibt gleich viele Plaetze, kostet aber mehr — der erste Ausbau lohnt klar, der
    // Vollausbau ist eine Entscheidung. Geprueft wird die Eigenschaft, nicht die Kostentabelle:
    // gleiche Schrittweite auf allen Stufen.
    const schritte = [1, 2, 3, 4, 5].map(
      (stufe) => getScoutingWishlistSlotsForLevel(stufe) - getScoutingWishlistSlotsForLevel(stufe - 1),
    );
    expect(new Set(schritte).size, `ungleiche Schritte: ${schritte.join(", ")}`).toBe(1);
    expect(schritte[0]).toBeGreaterThan(0);
  });

  it("klammert negative Stufen auf die Grundplaetze", () => {
    expect(getScoutingWishlistSlotsForLevel(-1)).toBe(6);
  });

  // Bug 2026-07-31: "für den Draft müssen wir die Wishlist auf bis zu 15
  // Slots erhöhen". Vorher war das Limit im Draft `null` (unbegrenzt) statt
  // zu klein — dieser Test bleibt ohne den 15er-Cap grün und zeigt die
  // eigentliche Änderung nicht. Der nächste Test macht den fehlenden Cap rot.
  it("caps the wishlist at 15 slots during the setup draft on season 1 (not unlimited)", () => {
    const draftState = createGameState({
      scoutingLevel: 0,
      seasonId: "season-1",
      gamePhase: "preseason_management",
      rosterCount: 0,
      newGameFlowActive: true,
      wishlist: Array.from({ length: DRAFT_TRANSFER_WISHLIST_SLOT_LIMIT }, (_, index) => ({
        playerId: `p-${index}`,
        createdAt: `2026-06-25T${String(index).padStart(2, "0")}:00:00.000Z`,
      })),
    });
    expect(isTeamSetupDraftWishlistPhase(draftState, "M-M")).toBe(true);
    expect(getScoutingWishlistSlotLimit(draftState, "M-M")).toBe(15);
    expect(getActiveScoutingWishlistEntries(draftState, "M-M")).toHaveLength(15);
  });

  it("allows the 15th wishlist entry in the draft but rejects a 16th", () => {
    // Ohne die 15er-Grenze ist die Wishlist im Draft unbegrenzt (`limit: null`)
    // — dieser Test ist rot, solange getScoutingWishlistSlotLimit im Draft
    // `null` statt 15 zurückgibt.
    const fourteenEntries = createGameState({
      seasonId: "season-1",
      gamePhase: "preseason_management",
      newGameFlowActive: true,
      wishlist: Array.from({ length: 14 }, (_, index) => ({
        playerId: `p-${index}`,
        createdAt: `2026-06-25T${String(index).padStart(2, "0")}:00:00.000Z`,
      })),
    });
    expect(canAddPlayerToTransferWishlist(fourteenEntries, "M-M", "p-15th").ok).toBe(true);

    const fifteenEntries = createGameState({
      seasonId: "season-1",
      gamePhase: "preseason_management",
      newGameFlowActive: true,
      wishlist: Array.from({ length: 15 }, (_, index) => ({
        playerId: `p-${index}`,
        createdAt: `2026-06-25T${String(index).padStart(2, "0")}:00:00.000Z`,
      })),
    });
    const rejected = canAddPlayerToTransferWishlist(fifteenEntries, "M-M", "p-16th");
    expect(rejected.ok).toBe(false);
    expect(rejected.limit).toBe(15);
    // Bereits gesetzte Spieler dürfen trotzdem entfernt/erneut markiert werden.
    expect(canAddPlayerToTransferWishlist(fifteenEntries, "M-M", "p-0").ok).toBe(true);
  });

  // Chris' gemeldeter Fall: Kader schon über dem Mindestmaß (`playerMin`),
  // aber der Einstiegs-Flow (`newGameFlow.active`) läuft noch — Sponsor-Wahl
  // und Aufstellung sind offen. Die alte, rein rosterbasierte Prüfung hätte
  // die Draft-Phase hier fälschlich schon für beendet erklärt und sofort die
  // (sehr niedrige) Scouting-Grenze angewendet.
  it("stays in the draft phase while newGameFlow is active even after the roster passes playerMin", () => {
    const state = createGameState({
      scoutingLevel: 0,
      seasonId: "season-1",
      gamePhase: "preseason_management",
      rosterCount: 9, // identity.playerMin ist 7 in der Test-Fixture — Kader liegt schon darüber.
      newGameFlowActive: true,
    });
    expect(isTeamSetupDraftWishlistPhase(state, "M-M")).toBe(true);
    expect(getScoutingWishlistSlotLimit(state, "M-M")).toBe(15);
  });

  it("falls back to the roster-based check when a save has no newGameFlow at all", () => {
    // Alte/Multiplayer-Saves ohne newGameFlow: Draft gilt bis Mindestkader erreicht ist.
    const belowTarget = createGameState({ seasonId: "season-1", gamePhase: "preseason_management", rosterCount: 0 });
    expect(isTeamSetupDraftWishlistPhase(belowTarget, "M-M")).toBe(true);
    const atOrAboveTarget = createGameState({ seasonId: "season-1", gamePhase: "preseason_management", rosterCount: 7 });
    expect(isTeamSetupDraftWishlistPhase(atOrAboveTarget, "M-M")).toBe(false);
  });

  it("applies the regular scouting-level limit once the draft has ended (newGameFlow inactive)", () => {
    const postDraft = createGameState({
      scoutingLevel: 1,
      seasonId: "season-1",
      gamePhase: "preseason_management",
      newGameFlowActive: false,
      wishlist: Array.from({ length: 5 }, (_, index) => ({
        playerId: `p-${index}`,
        createdAt: `2026-06-25T${String(index).padStart(2, "0")}:00:00.000Z`,
      })),
    });
    expect(isTeamSetupDraftWishlistPhase(postDraft, "M-M")).toBe(false);
    expect(getScoutingWishlistSlotLimit(postDraft, "M-M")).toBe(getScoutingWishlistSlotsForLevel(1));
  });

  it("blocks wishlist adds when regular slots are full", () => {
    // Die Liste wird GENAU bis ans Limit gefuellt, statt eine feste Zahl Namen abzuschreiben — sonst
    // prueft der Test nach der naechsten Slot-Aenderung nur noch, dass irgendeine Liste zu kurz ist.
    const limit = getScoutingWishlistSlotsForLevel(1);
    const full = createGameState({
      scoutingLevel: 1,
      wishlist: Array.from({ length: limit }, (_, index) => ({
        playerId: `p-${index + 1}`,
        createdAt: `2026-06-25T${String(index).padStart(2, "0")}:00:00.000Z`,
      })),
    });
    expect(canAddPlayerToTransferWishlist(full, "M-M").ok).toBe(false);
    // Ein Spieler, der schon drauf steht, darf immer — er belegt keinen zusaetzlichen Platz.
    expect(canAddPlayerToTransferWishlist(full, "M-M", "p-1").ok).toBe(true);
  });

  it("prefers wishlist players in the scout pipeline and advances certainty on tick", () => {
    const gameState = createGameState({
      scoutingLevel: 1,
      wishlist: [{ playerId: "p-1", createdAt: "2026-06-25T00:00:00.000Z" }],
      rosterCount: 10,
      seasonId: "season-1",
      gamePhase: "season_active",
    });
    const refreshed = refreshScoutPipeline(gameState, "M-M");
    const records = refreshed.seasonState.scoutIntelByTeamId?.["M-M"] ?? [];
    expect(records).toHaveLength(1);
    expect(records[0]?.source).toBe("wishlist_mirror");

    // As the sole (and thus rank-1) wishlist entry, p-1 is the scouting focus
    // target and gets the flat focus tick gain (20) instead of the regular
    // wishlist_mirror tick rate — see Scouting Tab Rework focus queue.
    const afterTick = advanceScoutIntelTick({ gameState: refreshed, teamId: "M-M", phase: "matchday" });
    expect(afterTick.seasonState.scoutIntelByTeamId?.["M-M"]?.[0]?.certainty).toBe(20);
    expect(getEffectiveScoutingLevel(afterTick, "M-M", "p-1")).toBeGreaterThanOrEqual(1);
  });

  it("does not advance scout intel at scouting office L0", () => {
    const gameState = createGameState({
      scoutingLevel: 0,
      wishlist: [{ playerId: "p-1", createdAt: "2026-06-25T00:00:00.000Z" }],
      rosterCount: 10,
      seasonId: "season-1",
      gamePhase: "season_active",
    });
    const refreshed = refreshScoutPipeline(gameState, "M-M");
    const afterTick = advanceScoutIntelTick({ gameState: refreshed, teamId: "M-M", phase: "matchday" });
    expect(afterTick.seasonState.scoutIntelByTeamId?.["M-M"]?.[0]?.certainty).toBe(0);
  });

  it("only keeps the oldest wishlist entries within the regular slot limit", () => {
    const gameState = createGameState({
      scoutingLevel: 0,
      rosterCount: 10,
      seasonId: "season-1",
      gamePhase: "season_active",
      wishlist: Array.from({ length: getScoutingWishlistSlotsForLevel(0) + 1 }, (_, index) => ({
        playerId: `p-${index + 1}`,
        createdAt: `2026-06-25T${String(index).padStart(2, "0")}:00:00.000Z`,
      })),
    });
    // Genau ein Eintrag mehr als Plaetze — der aelteste Satz bleibt aktiv, der letzte faellt raus.
    expect(getActiveScoutingWishlistEntries(gameState, "M-M").map((entry) => entry.playerId)).toEqual(
      Array.from({ length: getScoutingWishlistSlotsForLevel(0) }, (_, index) => `p-${index + 1}`),
    );
    const refreshed = refreshScoutPipeline(gameState, "M-M");
    expect((refreshed.seasonState.scoutIntelByTeamId?.["M-M"] ?? []).map((entry) => entry.playerId)).toEqual(
      Array.from({ length: getScoutingWishlistSlotsForLevel(0) }, (_, index) => `p-${index + 1}`),
    );
  });

  // Absicherung für die schon vorhandene Kappung beim Übergang vom Draft (15
  // Slots) auf das Scouting-Niveau — bisher ungetestet, aber bewusst nicht
  // neu gebaut (Aufgabe: nur absichern).
  describe("trimTransferWishlistToSlotLimit (Kappung beim Übergang Draft → Scouting)", () => {
    it("keeps only the highest-priority entries up to the post-draft scouting limit", () => {
      // Zwei Eintraege mehr als Plaetze, aus den Konstanten abgeleitet — die Kappung soll sichtbar
      // greifen, ohne dass die Zahl im Test steht.
      const nachDraftLimit = getScoutingWishlistSlotsForLevel(0);
      const gameState = createGameState({
        scoutingLevel: 0,
        seasonId: "season-1",
        gamePhase: "season_active", // Draft vorbei, reguläre Scouting-Grenze gilt.
        wishlist: [
          ...Array.from({ length: nachDraftLimit + 2 }, (_, index) => ({
            playerId: `p-${index + 1}`,
            createdAt: `2026-06-25T${String(index).padStart(2, "0")}:00:00.000Z`,
            priorityRank: index,
          })),
          // Team-fremder Eintrag, muss unabhängig von der Grenze erhalten bleiben.
          { playerId: "other-1", createdAt: "2026-06-25T23:00:00.000Z", priorityRank: 0, teamId: "L-K" },
        ],
      });
      const trimmed = trimTransferWishlistToSlotLimit(
        gameState.seasonState.transferWishlist ?? [],
        gameState,
        "M-M",
      );
      expect(trimmed.filter((entry) => entry.teamId === "M-M").map((entry) => entry.playerId)).toEqual(
        Array.from({ length: nachDraftLimit }, (_, index) => `p-${index + 1}`),
      );
      expect(trimmed.some((entry) => entry.playerId === "other-1")).toBe(true);
    });

    it("does not trim during the draft, where the wishlist limit is 15, not the scouting level", () => {
      const draftState = createGameState({
        scoutingLevel: 0,
        seasonId: "season-1",
        gamePhase: "preseason_management",
        newGameFlowActive: true,
        wishlist: Array.from({ length: 10 }, (_, index) => ({
          playerId: `p-${index}`,
          createdAt: `2026-06-25T${String(index).padStart(2, "0")}:00:00.000Z`,
          priorityRank: index,
        })),
      });
      const trimmed = trimTransferWishlistToSlotLimit(draftState.seasonState.transferWishlist ?? [], draftState, "M-M");
      expect(trimmed).toHaveLength(10);
    });
  });
});
