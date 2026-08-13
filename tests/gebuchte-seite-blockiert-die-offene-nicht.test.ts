/**
 * EINE BEREITS GEBUCHTE SEITE DARF DIE NOCH OFFENE NICHT BLOCKIEREN.
 *
 * GEMELDET VON CHRIS: „wieso wird D1 in D2 noch mal gerechnet? das ist doch gar nicht noetig!"
 *
 * Er hat recht, und das Schreiben weiss es laengst: `legacy-matchday-result-apply-service.ts`
 * friert bereits gebuchte Seiten ein (`frozenSides`) — die neu gerechneten D1-Zeilen werden
 * verworfen, die gespeicherten bleiben stehen. Am Live-Abbild nachgemessen: von 32 vorher
 * gebuchten D1-Zeilen waren nach dem D2-Commit 32 unveraendert, 0 veraendert.
 *
 * ENTSCHIEDEN hat die verworfene Rechnung trotzdem mit. Kippte sie auf `missing_scores`, war der
 * ganze Spieltag blockiert — auch die Seite, um die es ging. Genau daran hing Chris' Spieltag 4.
 *
 * Was nicht geschrieben wird, darf auch nicht mitentscheiden. Die Freigabe zaehlt jetzt nur die
 * Seiten, die dieser Lauf wirklich schreibt.
 *
 * NICHT aufgeweicht: Sind beide Seiten offen (der Normalfall), gilt weiterhin der Gesamtstatus —
 * die zweite Pruefung unten haelt das fest. Ein halber Spieltag rutscht dadurch nicht durch.
 */
import { describe, expect, it } from "vitest";

import { createFreshSeasonOneGameState } from "@/lib/game-state/singleplayer-state";
import { applyAiLegacyLineupBatchLocally } from "@/lib/ai/ai-legacy-lineup-batch-apply-service";
import { loadLocalLegacyLineupContext } from "@/lib/lineups/legacy-lineup-local-service";
import { getResolveStatusForSides } from "@/lib/resolve/legacy-matchday-resolve-engine";
import { MATCHDAY_AUTO_RUN_CONFIRM_TOKEN, runLocalMatchdayAutoRun } from "@/lib/season/matchday-auto-run-service";
import type { GameState } from "@/lib/data/olyDataTypes";
import type { LegacyMatchdayResolvePreview } from "@/lib/resolve/legacy-matchday-resolve-types";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";

const SAVE_ID = "test-save";

function createInMemoryPersistence(gameState: GameState): PersistenceService {
  let save: PersistedSaveGame = {
    saveId: SAVE_ID,
    name: "Test",
    status: "active",
    createdAt: "2026-06-06T00:00:00.000Z",
    updatedAt: "2026-06-06T00:00:00.000Z",
    gameState: structuredClone(gameState),
  } as PersistedSaveGame;
  return {
    getOrCreateActiveSave: () => ({ save, createdFromSeed: false }),
    bootstrapSingleplayerSave: () => ({ save, createdFromSeed: false }),
    getActiveSave: () => save,
    getSaveById: (saveId: string) => (save.saveId === saveId ? save : null),
    saveSingleplayerState(saveId: string, next: GameState) {
      if (save.saveId !== saveId) throw new Error(`Unknown save ${saveId}`);
      save = { ...save, gameState: structuredClone(next) };
      return save;
    },
    listSaves: () => [
      {
        saveId: save.saveId,
        name: save.name,
        status: save.status,
        createdAt: save.createdAt,
        updatedAt: save.updatedAt,
      },
    ],
    activateSave: (saveId: string) => (save.saveId === saveId ? save : null),
    createSave() {
      throw new Error("Not implemented in test persistence.");
    },
    createFreshSeasonOneSave() {
      throw new Error("Not implemented in test persistence.");
    },
    cloneSave() {
      throw new Error("Not implemented in test persistence.");
    },
  } as unknown as PersistenceService;
}

function fuelleKaderAuf(gameState: GameState) {
  const contextResult = loadLocalLegacyLineupContext(
    {
      saveId: SAVE_ID,
      seasonId: gameState.season.id,
      matchdayId: gameState.matchdayState.matchdayId,
      teamId: gameState.teams[0]!.teamId,
    },
    createInMemoryPersistence(gameState),
  );
  if (!contextResult.ok) throw new Error(contextResult.errors.join(" | "));
  const benoetigt =
    (contextResult.context.matchdayContract?.discipline1?.requiredPlayers ?? 0) +
    (contextResult.context.matchdayContract?.discipline2?.requiredPlayers ?? 0);

  const belegt = new Set(gameState.rosters.map((entry) => entry.playerId));
  const frei = gameState.players.filter((player) => !belegt.has(player.id));
  let index = 0;
  let zaehler = gameState.rosters.length;
  for (const team of gameState.teams) {
    const kader = gameState.rosters.filter((entry) => entry.teamId === team.teamId);
    for (let i = 0; i < Math.max(0, benoetigt - kader.length); i += 1) {
      const player = frei[index];
      if (!player) throw new Error("Zu wenige freie Spieler fuer den Testkader.");
      index += 1;
      zaehler += 1;
      gameState.rosters.push({
        id: `test-roster-${zaehler}`,
        teamId: team.teamId,
        playerId: player.id,
        contractLength: 3,
        salary: Math.round(player.salaryDemand),
        upkeep: Math.round(player.salaryDemand),
        purchasePrice: Math.round(player.marketValue),
        currentValue: Math.round(player.marketValue),
        roleTag: "bench",
        joinedSeasonId: gameState.season.id,
      });
    }
  }
}

function baueAllesKiStand(): GameState {
  const gameState = createFreshSeasonOneGameState();
  fuelleKaderAuf(gameState);
  const vorhandene = gameState.seasonState.teamControlSettings ?? {};
  gameState.seasonState.teamControlSettings = Object.fromEntries(
    gameState.teams.map((team) => [
      team.teamId,
      {
        ...vorhandene[team.teamId],
        teamId: team.teamId,
        controlMode: "ai" as const,
        aiLineupPreviewEnabled: true,
        aiLineupApplyEnabled: true,
        aiLineupAutoApplyEnabled: false,
        aiTransferPreviewEnabled: false,
        aiTransferAutoApplyEnabled: false,
        aiSellPreviewEnabled: false,
        aiSellAutoApplyEnabled: false,
        notes: null,
        strategyLock: null,
      },
    ]),
  );
  return gameState;
}

function seitenZaehlen(gameState: GameState, matchdayId: string) {
  const resultId = (gameState.seasonState.matchdayResults ?? []).find((entry) => entry.matchdayId === matchdayId)?.id;
  const zeilen = (gameState.seasonState.disciplineResults ?? []).filter(
    (entry) => entry.matchdayResultId === resultId,
  );
  return {
    d1: zeilen.filter((entry) => entry.disciplineSide === "d1").length,
    d2: zeilen.filter((entry) => entry.disciplineSide === "d2").length,
  };
}

/**
 * Nimmt einem in D1 aufgestellten Spieler den Disziplinwert — genau Chris' Lage nach dem
 * D1-Commit. Die AUFSTELLUNG bleibt vollstaendig (der Eintrag steht weiter im Draft), nur die
 * WERTUNG kann ihn nicht mehr rechnen. Der Kaderplatz bleibt ebenfalls, sonst waere es ein
 * anderer Fall (unvollstaendige Aufstellung), der zu Recht anders behandelt wird.
 */
function nimmAufgestelltemD1SpielerDenDisziplinwert(gameState: GameState, matchdayId: string) {
  const draft = (gameState.seasonState.lineupDrafts ?? []).find(
    (entry) => entry.matchdayId === matchdayId && entry.entries.some((slot) => slot.disciplineSide === "d1"),
  );
  if (!draft) throw new Error("Keine D1-Aufstellung gefunden.");
  const slot = draft.entries.find((entry) => entry.disciplineSide === "d1")!;
  gameState.players = gameState.players.filter((player) => player.id !== slot.playerId);
  return { teamId: draft.teamId, playerId: slot.playerId };
}

async function laufe(persistence: PersistenceService, seite: "d1" | "d2") {
  const gameState = persistence.getSaveById(SAVE_ID)!.gameState;
  return runLocalMatchdayAutoRun(
    {
      source: "sqlite",
      saveId: SAVE_ID,
      seasonId: gameState.season.id,
      matchdayId: gameState.matchdayState.matchdayId,
      execute: true,
      dryRun: false,
      confirmToken: MATCHDAY_AUTO_RUN_CONFIRM_TOKEN,
      options: {
        commitThroughSide: seite,
        advanceAfterCashApply: false,
        includeWarningLineups: true,
        overwriteExistingLineups: false,
        stopOnTie: false,
      },
    },
    persistence,
  );
}

describe("Die Freigabe zaehlt nur die Seiten, die dieser Lauf schreibt", () => {
  it("liest den Status seitenweise", () => {
    // Kein Spielstand noetig: die Auskunft selbst muss stimmen.
    const preview = {
      status: "missing_scores",
      disciplinePreviews: [
        { disciplineSide: "d1", teamResults: [{ status: "ready" }, { status: "missing_scores" }] },
        { disciplineSide: "d2", teamResults: [{ status: "ready" }, { status: "ready" }] },
      ],
    } as unknown as LegacyMatchdayResolvePreview;

    expect(getResolveStatusForSides(preview, new Set(["d1", "d2"]))).toBe("missing_scores");
    expect(getResolveStatusForSides(preview, new Set(["d2"]))).toBe("ready");
    expect(getResolveStatusForSides(preview, new Set(["d1"]))).toBe("missing_scores");
    // Ohne Einschraenkung bleibt es beim Gesamtstatus.
    expect(getResolveStatusForSides(preview, new Set())).toBe("missing_scores");
  });

  /**
   * WAS DIESER TEST ZEIGT — UND WAS NICHT.
   *
   * Geprueft wird die FREIGABE: der Wertungs-Schritt darf den Status der bereits gebuchten Seite
   * nicht mehr melden. Genau das war die Sperre, an der Chris' Spieltag hing.
   *
   * NICHT geprueft wird, dass der Lauf danach bis zum Schreiben durchlaeuft: der kuenstliche
   * Defekt (ein aufgestellter Spieler verschwindet aus dem Spielerverzeichnis) laesst zusaetzlich
   * den KI-Aufstellungs-Schritt davor anschlagen (`lineup_not_operationally_ready`). Das ist eine
   * andere, eigenstaendige Pruefung und bleibt bewusst unberuehrt. In Chris' Lage gab es diesen
   * Defekt nicht — dort war der Spieler vorhanden, nur ohne Disziplinwert.
   */
  it("meldet den Status der bereits gebuchten Seite nicht mehr als Blocker", async () => {
    const persistence = createInMemoryPersistence(baueAllesKiStand());
    const matchdayId = persistence.getSaveById(SAVE_ID)!.gameState.matchdayState.matchdayId;
    applyAiLegacyLineupBatchLocally(
      {
        saveId: SAVE_ID,
        seasonId: persistence.getSaveById(SAVE_ID)!.gameState.season.id,
        matchdayId,
        dryRun: false,
        includeWarningTeams: true,
        overwriteExisting: true,
      },
      persistence,
    );

    // Schritt 1: nur D1 buchen — der Zustand, in dem Chris' Spieltag stand.
    await laufe(persistence, "d1");
    const nachD1 = seitenZaehlen(persistence.getSaveById(SAVE_ID)!.gameState, matchdayId);
    expect(nachD1.d1).toBeGreaterThan(0);
    expect(nachD1.d2).toBe(0);

    // Schritt 2: die gebuchte Seite wird unrechenbar.
    const zustand = persistence.getSaveById(SAVE_ID)!.gameState;
    nimmAufgestelltemD1SpielerDenDisziplinwert(zustand, matchdayId);
    persistence.saveSingleplayerState(SAVE_ID, zustand);

    // Schritt 3: der Wertungs-Schritt darf daran nicht mehr scheitern.
    const lauf = await laufe(persistence, "d2");
    const wertung = lauf.steps.find((step) => step.key === "resolve_preview");
    expect(wertung, "Der Wertungs-Schritt muss ueberhaupt gelaufen sein.").toBeTruthy();
    expect(wertung!.blockingReasons.filter((grund) => grund.startsWith("resolve_status:"))).toEqual([]);

    // Und die gebuchte D1 bleibt unangetastet.
    expect(seitenZaehlen(persistence.getSaveById(SAVE_ID)!.gameState, matchdayId).d1).toBe(nachD1.d1);
  }, 180_000);

  it("blockiert weiterhin, solange BEIDE Seiten offen sind", async () => {
    const persistence = createInMemoryPersistence(baueAllesKiStand());
    const matchdayId = persistence.getSaveById(SAVE_ID)!.gameState.matchdayState.matchdayId;
    applyAiLegacyLineupBatchLocally(
      {
        saveId: SAVE_ID,
        seasonId: persistence.getSaveById(SAVE_ID)!.gameState.season.id,
        matchdayId,
        dryRun: false,
        includeWarningTeams: true,
        overwriteExisting: true,
      },
      persistence,
    );

    // Derselbe Defekt, aber NICHTS ist gebucht — hier muss die Sperre greifen, sonst haette der
    // Fix die Wertung insgesamt aufgeweicht.
    const zustand = persistence.getSaveById(SAVE_ID)!.gameState;
    nimmAufgestelltemD1SpielerDenDisziplinwert(zustand, matchdayId);
    persistence.saveSingleplayerState(SAVE_ID, zustand);

    const lauf = await laufe(persistence, "d2");
    const wertung = lauf.steps.find((step) => step.key === "resolve_preview");
    expect(wertung!.blockingReasons).toContain("resolve_status:missing_scores");
    expect(seitenZaehlen(persistence.getSaveById(SAVE_ID)!.gameState, matchdayId).d2).toBe(0);
  }, 180_000);
});
