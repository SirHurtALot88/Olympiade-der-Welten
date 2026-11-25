import { describe, expect, it } from "vitest";

import { applyAiLegacyLineupBatchLocally, mergeDelegatedLineupModifiers } from "@/lib/ai/ai-legacy-lineup-batch-apply-service";
import { createFreshSeasonOneGameState } from "@/lib/game-state/singleplayer-state";
import { loadLocalLegacyLineupContext } from "@/lib/lineups/legacy-lineup-local-service";
import { buildGameInboxItems } from "@/lib/foundation/game-inbox-service";
import {
  buildMatchdayReadinessTeamsFromState,
  evaluateMatchdayHumanReadiness,
} from "@/lib/foundation/matchday-human-readiness";
import {
  applyGameModeOwnership,
  DEFAULT_ACTIVE_OWNER_ID,
  RAMONA_OWNER_ID,
} from "@/lib/foundation/team-control-settings";
import { createDefaultLineupDraftModifiers } from "@/lib/lineups/legacy-lineup-modifiers";
import type { GameState, LineupDraft } from "@/lib/data/olyDataTypes";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";

/**
 * MEHRSPIELER-DELEGATION, Einsatzliste (Chris, 18.11.): „Einsätze laufen KI-mäßig und werden auto
 * eingesetzt … Setzt der Mensch selbst Spieler, füllt die KI nur den Rest.“
 *
 * Drei Menschen: Chris (voll selbst), Franky (voll selbst), Ramona (Halbautomatik). Geprueft wird,
 * dass der KI-Batch eines Spieltags
 *  - Ramonas leere Einsatzliste komplett aufstellt,
 *  - von Ramona selbst gesetzte Spieler NICHT anfasst und nur die Luecken fuellt,
 *  - einen verletzten, von Ramona gesetzten Spieler ersetzt (KI regelt Vorfaelle),
 *  - Chris' und Frankys Teams weiter unangetastet laesst (`skipped_manual`, wie vor dem 18.11.),
 * und dass Ramonas offene Einsatzliste Chris' Ablauf nicht aufhaelt.
 */

const SAVE_ID = "delegation-test-save";

function createInMemoryPersistence(gameState: GameState): PersistenceService & { current: () => PersistedSaveGame } {
  let save: PersistedSaveGame = {
    saveId: SAVE_ID,
    name: "Delegation Test",
    status: "active",
    createdAt: "2026-11-18T00:00:00.000Z",
    updatedAt: "2026-11-18T00:00:00.000Z",
    gameState: structuredClone(gameState),
  };
  const nichtGebaut = () => {
    throw new Error("Not implemented in test persistence.");
  };
  return {
    current: () => save,
    bootstrapSingleplayerSave: () => ({ save, createdFromSeed: false }),
    getActiveSave: () => save,
    getSaveById: (saveId: string) => (save.saveId === saveId ? save : null),
    saveSingleplayerState(saveId: string, nextGameState: GameState) {
      if (save.saveId !== saveId) throw new Error(`Unknown save ${saveId}`);
      save = { ...save, gameState: structuredClone(nextGameState) };
      return save;
    },
    createSave: nichtGebaut,
    createFreshSeasonOneSave: nichtGebaut,
    cloneSave: nichtGebaut,
    activateSave: (saveId: string) => (save.saveId === saveId ? save : null),
    getSaveVersionMetadata: nichtGebaut,
    createScenarioSnapshot: nichtGebaut,
    deleteSave: nichtGebaut,
    deleteSaves: nichtGebaut,
    listSaves: () => [
      { saveId: save.saveId, name: save.name, status: save.status, createdAt: save.createdAt, updatedAt: save.updatedAt },
    ],
  } as unknown as PersistenceService & { current: () => PersistedSaveGame };
}

function topUpRosters(gameState: GameState) {
  const persistence = createInMemoryPersistence(gameState);
  const contextResult = loadLocalLegacyLineupContext(
    { saveId: SAVE_ID, seasonId: gameState.season.id, matchdayId: gameState.matchdayState.matchdayId, teamId: gameState.teams[0]!.teamId },
    persistence,
  );
  if (!contextResult.ok) throw new Error(contextResult.errors.join(" | "));
  const required =
    (contextResult.context.matchdayContract?.discipline1?.requiredPlayers ?? 0) +
    (contextResult.context.matchdayContract?.discipline2?.requiredPlayers ?? 0);
  const used = new Set(gameState.rosters.map((entry) => entry.playerId));
  const free = gameState.players.filter((player) => !used.has(player.id));
  let pool = 0;
  for (const team of gameState.teams) {
    const shortfall = Math.max(0, required + 3 - gameState.rosters.filter((entry) => entry.teamId === team.teamId).length);
    for (let index = 0; index < shortfall; index += 1) {
      const player = free[pool++]!;
      gameState.rosters.push({
        id: `delegation-roster-${pool}`,
        teamId: team.teamId,
        playerId: player.id,
        contractLength: 3,
        salary: Math.round(player.salaryDemand),
        upkeep: Math.round(player.salaryDemand),
        purchasePrice: Math.round(player.marketValue),
        currentValue: Math.round(player.marketValue),
        joinedSeasonId: gameState.season.id,
      });
    }
  }
  return {
    d1: contextResult.context.contextMeta.d1DisciplineId!,
    d2: contextResult.context.contextMeta.d2DisciplineId!,
    d1Count: contextResult.context.matchdayContract?.discipline1?.requiredPlayers ?? 0,
    d2Count: contextResult.context.matchdayContract?.discipline2?.requiredPlayers ?? 0,
  };
}

function buildThreeHumanFixture() {
  const base = createFreshSeasonOneGameState();
  const sides = topUpRosters(base);
  const [chrisTeam, frankyTeam, ramonaTeam] = base.teams.map((team) => team.teamId);
  const gameState = applyGameModeOwnership(base, {
    saveMode: "custom",
    chrisTeamIds: [chrisTeam!],
    frankyTeamIds: [frankyTeam!],
    ramonaTeamIds: [ramonaTeam!],
  });
  // Ein frischer Spieltag: noch niemand hat aufgestellt.
  gameState.seasonState.lineupDrafts = [];
  return { gameState, sides, chrisTeam: chrisTeam!, frankyTeam: frankyTeam!, ramonaTeam: ramonaTeam! };
}

function runBatch(persistence: PersistenceService, gameState: GameState) {
  return applyAiLegacyLineupBatchLocally(
    {
      saveId: SAVE_ID,
      seasonId: gameState.season.id,
      matchdayId: gameState.matchdayState.matchdayId,
      overwriteExisting: false,
      dryRun: false,
    },
    persistence,
  );
}

function draftOf(gameState: GameState, teamId: string): LineupDraft | null {
  return (
    (gameState.seasonState.lineupDrafts ?? []).find(
      (draft) => draft.teamId === teamId && draft.matchdayId === gameState.matchdayState.matchdayId,
    ) ?? null
  );
}

function rosterIdsOf(gameState: GameState, teamId: string) {
  return gameState.rosters.filter((entry) => entry.teamId === teamId).map((entry) => entry.playerId);
}

describe("Mehrspieler-Delegation: Einsatzliste und Formkarten", () => {
  it("Ramona (Halbautomatik) wird komplett aufgestellt, Chris und Franky bleiben unberuehrt", () => {
    const fixture = buildThreeHumanFixture();
    const settings = fixture.gameState.seasonState.teamControlSettings!;
    expect(settings[fixture.ramonaTeam]?.ownerId).toBe(RAMONA_OWNER_ID);
    expect(settings[fixture.ramonaTeam]?.delegation?.stufe).toBe("halbautomatik");
    expect(settings[fixture.chrisTeam]?.delegation).toBeUndefined();

    const persistence = createInMemoryPersistence(fixture.gameState);
    const result = runBatch(persistence, fixture.gameState);
    const byTeam = new Map(result.results.map((entry) => [entry.teamId, entry]));

    expect(byTeam.get(fixture.ramonaTeam)?.result).toBe("saved");
    expect(byTeam.get(fixture.ramonaTeam)?.saved).toBe(true);
    expect(byTeam.get(fixture.ramonaTeam)?.lineupDelegated).toBe(true);
    expect(byTeam.get(fixture.chrisTeam)?.result).toBe("skipped_manual");
    expect(byTeam.get(fixture.frankyTeam)?.result).toBe("skipped_manual");
    expect(byTeam.get(fixture.chrisTeam)?.lineupDelegated).toBeUndefined();

    const after = persistence.current().gameState;
    const ramonaDraft = draftOf(after, fixture.ramonaTeam);
    expect(ramonaDraft?.entries.filter((entry) => entry.disciplineSide === "d1")).toHaveLength(fixture.sides.d1Count);
    expect(ramonaDraft?.entries.filter((entry) => entry.disciplineSide === "d2")).toHaveLength(fixture.sides.d2Count);
    expect(draftOf(after, fixture.chrisTeam)).toBeNull();
    expect(draftOf(after, fixture.frankyTeam)).toBeNull();
  });

  it("von Ramona gesetzte Spieler bleiben stehen, die KI fuellt nur die Luecken", () => {
    const fixture = buildThreeHumanFixture();
    const roster = rosterIdsOf(fixture.gameState, fixture.ramonaTeam);
    // Ramona setzt selbst: einen Spieler auf d1, Slot 1 (nicht 0), mit Kapitaensbinde, und einen auf d2.
    const humanEntries = [
      { disciplineId: fixture.sides.d1, disciplineSide: "d1" as const, slotIndex: 1, playerId: roster[0]!, activePlayerId: null, isCaptain: true },
      { disciplineId: fixture.sides.d2, disciplineSide: "d2" as const, slotIndex: 0, playerId: roster[1]!, activePlayerId: null },
    ];
    fixture.gameState.seasonState.lineupDrafts = [
      {
        lineupId: `legacy-lineup:${SAVE_ID}:${fixture.gameState.season.id}:${fixture.gameState.matchdayState.matchdayId}:${fixture.ramonaTeam}`,
        saveId: SAVE_ID,
        seasonId: fixture.gameState.season.id,
        matchdayId: fixture.gameState.matchdayState.matchdayId,
        teamId: fixture.ramonaTeam,
        status: "draft",
        entries: humanEntries,
        modifiers: createDefaultLineupDraftModifiers(),
        createdAt: "2026-11-18T00:00:00.000Z",
        updatedAt: "2026-11-18T00:00:00.000Z",
      },
    ];

    const persistence = createInMemoryPersistence(fixture.gameState);
    const result = runBatch(persistence, fixture.gameState);
    expect(result.results.find((entry) => entry.teamId === fixture.ramonaTeam)).toMatchObject({ saved: true });

    const draft = draftOf(persistence.current().gameState, fixture.ramonaTeam)!;
    const d1 = draft.entries.filter((entry) => entry.disciplineSide === "d1");
    const d2 = draft.entries.filter((entry) => entry.disciplineSide === "d2");
    expect(d1).toHaveLength(fixture.sides.d1Count);
    expect(d2).toHaveLength(fixture.sides.d2Count);

    // Ramonas Wahl steht unveraendert: Spieler, Seite, Slot, Kapitaensbinde.
    const own = d1.find((entry) => entry.playerId === roster[0]);
    expect(own?.slotIndex).toBe(1);
    expect(own?.isCaptain).toBe(true);
    expect(d2.find((entry) => entry.playerId === roster[1])?.slotIndex).toBe(0);
    // Eine Binde je Seite: die KI vergibt auf d1 keine zweite.
    expect(d1.filter((entry) => entry.isCaptain)).toHaveLength(1);
    // Keine doppelten Spieler, keine doppelten Slots.
    const ids = draft.entries.map((entry) => entry.playerId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(d1.map((entry) => entry.slotIndex)).size).toBe(d1.length);
    expect(new Set(d2.map((entry) => entry.slotIndex)).size).toBe(d2.length);
  });

  it("eine vollstaendige Aufstellung von Ramona wird nicht ueberschrieben, auch nicht mit overwriteExisting", () => {
    const fixture = buildThreeHumanFixture();
    const persistence = createInMemoryPersistence(fixture.gameState);
    runBatch(persistence, fixture.gameState);
    const before = structuredClone(draftOf(persistence.current().gameState, fixture.ramonaTeam)!);

    const again = applyAiLegacyLineupBatchLocally(
      {
        saveId: SAVE_ID,
        seasonId: fixture.gameState.season.id,
        matchdayId: fixture.gameState.matchdayState.matchdayId,
        overwriteExisting: true,
        dryRun: false,
      },
      persistence,
    );
    expect(again.results.find((entry) => entry.teamId === fixture.ramonaTeam)?.result).toBe("skipped_existing");
    expect(draftOf(persistence.current().gameState, fixture.ramonaTeam)?.entries).toEqual(before.entries);
  });

  it("F3: alle Spieler von Ramona gesetzt, aber keine Formkarte: die KI legt die Karten nach, die Spieler bleiben", () => {
    const fixture = buildThreeHumanFixture();
    const persistence = createInMemoryPersistence(fixture.gameState);
    runBatch(persistence, fixture.gameState);
    // Ramonas fertiger Entwurf, aber ohne Karten (Mensch hat nur Spieler gesetzt).
    const state = persistence.current().gameState;
    const ohneKarten = structuredClone(draftOf(state, fixture.ramonaTeam)!);
    ohneKarten.modifiers = createDefaultLineupDraftModifiers();
    state.seasonState.lineupDrafts = (state.seasonState.lineupDrafts ?? []).map((draft) =>
      draft.teamId === fixture.ramonaTeam ? ohneKarten : draft,
    );
    const frisch = createInMemoryPersistence(state);
    const result = runBatch(frisch, state);
    expect(result.results.find((entry) => entry.teamId === fixture.ramonaTeam)?.result).toBe("saved");
    const danach = draftOf(frisch.current().gameState, fixture.ramonaTeam)!;
    expect(danach.entries).toEqual(ohneKarten.entries);
    const karten = [danach.modifiers?.d1, danach.modifiers?.d2].flatMap((side) => [side?.primaryFormCardId, side?.secondaryFormCardId]);
    expect(karten.filter(Boolean).length).toBeGreaterThan(0);

    // Zweiter Lauf: jetzt hat der Entwurf Karten, nichts wird mehr angefasst.
    const nochmal = runBatch(frisch, frisch.current().gameState);
    expect(nochmal.results.find((entry) => entry.teamId === fixture.ramonaTeam)?.result).toBe("skipped_existing");
    expect(draftOf(frisch.current().gameState, fixture.ramonaTeam)?.modifiers).toEqual(danach.modifiers);
  });

  it("F3: von Ramona gesetzte Formkarten bleiben unberuehrt", () => {
    const fixture = buildThreeHumanFixture();
    const persistence = createInMemoryPersistence(fixture.gameState);
    runBatch(persistence, fixture.gameState);
    const state = persistence.current().gameState;
    const eigene = structuredClone(draftOf(state, fixture.ramonaTeam)!);
    eigene.modifiers = createDefaultLineupDraftModifiers();
    eigene.modifiers.d1.primaryFormCardId = "karte-von-ramona";
    state.seasonState.lineupDrafts = (state.seasonState.lineupDrafts ?? []).map((draft) =>
      draft.teamId === fixture.ramonaTeam ? eigene : draft,
    );
    const frisch = createInMemoryPersistence(state);
    const result = runBatch(frisch, state);
    expect(result.results.find((entry) => entry.teamId === fixture.ramonaTeam)?.result).toBe("skipped_existing");
    expect(draftOf(frisch.current().gameState, fixture.ramonaTeam)?.modifiers?.d1.primaryFormCardId).toBe("karte-von-ramona");
  });

  it("ein verletzter Spieler in Ramonas Aufstellung wird ersetzt, die anderen bleiben", () => {
    const fixture = buildThreeHumanFixture();
    const persistence = createInMemoryPersistence(fixture.gameState);
    runBatch(persistence, fixture.gameState);
    const filled = structuredClone(persistence.current().gameState);
    const draft = draftOf(filled, fixture.ramonaTeam)!;
    const injured = draft.entries[0]!;
    filled.seasonState.playerAvailabilityState = [
      ...(filled.seasonState.playerAvailabilityState ?? []),
      {
        playerId: injured.playerId,
        teamId: fixture.ramonaTeam,
        fatigue: 40,
        injuryStatus: "injured",
        injuryUntilMatchday: filled.season.matchdayIds?.[5] ?? "season-1-matchday-6",
        injuredAtSeasonId: filled.season.id,
        injuredAtMatchdayId: filled.matchdayState.matchdayId,
        injuryReason: "test",
      } as never,
    ];
    const persistence2 = createInMemoryPersistence(filled);
    const result = runBatch(persistence2, filled);
    expect(result.results.find((entry) => entry.teamId === fixture.ramonaTeam)).toMatchObject({ saved: true });

    const after = draftOf(persistence2.current().gameState, fixture.ramonaTeam)!;
    const afterIds = new Set(after.entries.map((entry) => entry.playerId));
    expect(afterIds.has(injured.playerId)).toBe(false);
    expect(after.entries).toHaveLength(draft.entries.length);
    for (const entry of draft.entries.slice(1)) {
      const still = after.entries.find((candidate) => candidate.playerId === entry.playerId);
      expect(still?.disciplineSide).toBe(entry.disciplineSide);
      expect(still?.slotIndex).toBe(entry.slotIndex);
    }
  });

  it("Ramonas offene Einsatzliste blockiert weder die Bereitschaft noch Chris' Ablauf", () => {
    const fixture = buildThreeHumanFixture();
    const gameState = fixture.gameState;
    const settings = gameState.seasonState.teamControlSettings!;

    const readiness = evaluateMatchdayHumanReadiness(
      buildMatchdayReadinessTeamsFromState({
        teams: gameState.teams,
        controlModeByTeamId: settings,
        lineupDrafts: gameState.seasonState.lineupDrafts,
        seasonId: gameState.season.id,
        matchdayId: gameState.matchdayState.matchdayId,
      }),
    );
    // Chris und Franky stehen noch aus, Ramona nicht — ihre Einsatzliste stellt die KI.
    expect(readiness.pendingTeamIds.sort()).toEqual([fixture.chrisTeam, fixture.frankyTeam].sort());

    // Chris' Inbox: nur seine Teams. Ramonas Vorfaelle tauchen dort nicht auf.
    const chrisInbox = buildGameInboxItems({
      gameState,
      saveId: SAVE_ID,
      activeTeamId: fixture.chrisTeam,
      activeOwnerId: DEFAULT_ACTIVE_OWNER_ID,
    });
    expect(chrisInbox.some((item) => item.teamId === fixture.ramonaTeam)).toBe(false);
    expect(chrisInbox.some((item) => item.itemId.startsWith("lineup_missing:") && item.teamId === fixture.chrisTeam && item.severity === "critical")).toBe(true);

    // Auch wer ALLE Teams einblendet (Host-Ansicht), sieht Ramonas fehlende Einsatzliste nur als
    // Hinweis — kritisch (haelt die Leertaste an) ist sie nicht.
    const allInbox = buildGameInboxItems({
      gameState,
      saveId: SAVE_ID,
      activeTeamId: fixture.chrisTeam,
      activeOwnerId: DEFAULT_ACTIVE_OWNER_ID,
      hostMode: true,
    });
    const ramonaLineup = allInbox.find((item) => item.itemId.startsWith("lineup_missing:") && item.teamId === fixture.ramonaTeam);
    expect(ramonaLineup?.severity).toBe("info");
    expect(ramonaLineup?.description).toContain("Die KI übernimmt");
    // Nur die Aufgaben der delegierten Bereiche werden entschaerft; ein verfehltes Board-Ziel bleibt
    // Ramonas Sache und erscheint nur in der Alle-Teams-Ansicht.
    const delegierteBereiche = /^(lineup_missing|lineup_not_submitted|formcards_open|formcards_negative_open|training_missing|sponsor_choice_missing):/;
    expect(
      allInbox.filter((item) => item.teamId === fixture.ramonaTeam && item.severity === "critical" && delegierteBereiche.test(item.itemId)),
    ).toEqual([]);

    // Ramona selbst sieht ihre Teams.
    const ramonaInbox = buildGameInboxItems({
      gameState,
      saveId: SAVE_ID,
      activeTeamId: fixture.ramonaTeam,
      activeOwnerId: RAMONA_OWNER_ID,
    });
    expect(ramonaInbox.some((item) => item.teamId === fixture.ramonaTeam)).toBe(true);
    expect(ramonaInbox.some((item) => item.teamId === fixture.chrisTeam)).toBe(false);
  });
});

describe("mergeDelegatedLineupModifiers", () => {
  it("Formkarten des Menschen gewinnen als Ganzes, die KI legt keine dazu", () => {
    const human = createDefaultLineupDraftModifiers();
    human.d1.primaryFormCardId = "karte-mensch";
    const ai = createDefaultLineupDraftModifiers();
    ai.d1.primaryFormCardId = "karte-ki-1";
    ai.d2.primaryFormCardId = "karte-ki-2";
    ai.d2.intensity = "push";
    const merged = mergeDelegatedLineupModifiers(human, ai);
    expect(merged.d1.primaryFormCardId).toBe("karte-mensch");
    expect(merged.d2.primaryFormCardId).toBeNull();
    // Intensitaet „normal“ gilt als nicht gesetzt: die KI darf sie waehlen.
    expect(merged.d2.intensity).toBe("push");
  });

  it("ohne eigene Formkarten des Menschen bleiben die der KI", () => {
    const human = createDefaultLineupDraftModifiers();
    human.d2.intensity = "conserve";
    const ai = createDefaultLineupDraftModifiers();
    ai.d1.primaryFormCardId = "karte-ki-1";
    ai.d2.intensity = "push";
    const merged = mergeDelegatedLineupModifiers(human, ai);
    expect(merged.d1.primaryFormCardId).toBe("karte-ki-1");
    expect(merged.d2.intensity).toBe("conserve");
  });
});
