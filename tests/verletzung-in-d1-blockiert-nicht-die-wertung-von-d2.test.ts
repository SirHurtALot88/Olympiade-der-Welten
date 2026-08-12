/**
 * EINE IN D1 ZUGEZOGENE VERLETZUNG DARF D2 DESSELBEN SPIELTAGS NICHT UNWERTBAR MACHEN.
 *
 * GEMELDET VON CHRIS: „hilfe ich hänge in MD4 fest […] er lässt mich den tag auf jeden fall nicht
 * abschließen." Und praeziser: „aber MD4 hat nicht gescored und blocked auch so dass ich nicht
 * weiter komme."
 *
 * BEFUND am Live-Abbild (`new-game-1786465783606-0kalpx`, Saison 1, Spieltag 4): die Wertung von
 * D2 (Mini-DM) scheiterte mit `resolve_status:missing_scores`. Die zwei fehlenden Werte lagen
 * nicht in D2, sondern in der laengst gebuchten D1 (Wettessen) — bei Pvt Melinda und Malarik
 * (beide P-C). Beide standen im Kader, beide hatten einen Wettessen-Wert (25 bzw. 44,5). Beide
 * hatten sich AN DIESEM SPIELTAG in D1 verletzt (`fatigue_over_30_after_matchday_use`) und galten
 * seitdem als nicht einsatzfaehig.
 *
 * URSACHE: `loadLocalLegacyLineupContextFromGameState` baute die Disziplinwerte aus
 * `selectableActivePlayers` — also aus der um Verletzte BEREINIGTEN Auswahlliste:
 *
 *     disciplineScores: selectableActivePlayers.flatMap(({ player }) => …)
 *
 * Damit verlor jeder Spieler, der sich gerade verletzt hatte, seinen Disziplinwert. Die
 * abgegebene D1-Aufstellung enthielt ihn aber weiterhin — die Wertung des Spieltags meldete
 * `Missing discipline score`, der Status kippte auf `missing_scores`, und weil eine Wertung immer
 * den GANZEN Spieltag rechnet, war damit auch D2 tot. Der Spieltag hing dauerhaft.
 *
 * Die Sperre selbst ist richtig und bleibt: Wer sich in D1 verletzt, darf in D2 nicht mehr
 * AUFGESTELLT werden (`fatigue-injury-service.ts`, Folgedisziplin-Sperre). Aufstellen und Werten
 * sind aber zwei verschiedene Dinge — eine bereits abgegebene Aufstellung muss wertbar bleiben.
 * Der Server-Pfad (`legacy-lineup-context-loader.ts`) fuehrt die Werte ohnehin ungefiltert mit;
 * der lokale Pfad war der Ausreisser.
 */
import { describe, expect, it } from "vitest";

import { createFreshSeasonOneGameState } from "@/lib/game-state/singleplayer-state";
import { applyAiLegacyLineupBatchLocally } from "@/lib/ai/ai-legacy-lineup-batch-apply-service";
import {
  loadLocalLegacyLineupContext,
  loadLocalLegacyLineupContextFromGameState,
} from "@/lib/lineups/legacy-lineup-local-service";
import { buildLegacyMatchdayResolvePreview } from "@/lib/resolve/legacy-matchday-resolve-engine";
import { getPlayerAvailabilityView } from "@/lib/fatigue/fatigue-injury-service";
import type { GameState } from "@/lib/data/olyDataTypes";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";

const SAVE_ID = "test-save";

function createInMemoryPersistence(gameState: GameState): PersistenceService {
  let save: PersistedSaveGame = {
    saveId: SAVE_ID,
    name: "Test",
    status: "active",
    createdAt: "2026-06-06T00:00:00.000Z",
    updatedAt: "2026-06-06T00:00:00.000Z",
    gameState,
  } as PersistedSaveGame;
  return {
    getOrCreateActiveSave() {
      return { save, createdFromSeed: false };
    },
    getActiveSave() {
      return save;
    },
    getSaveById(saveId: string) {
      return save.saveId === saveId ? save : null;
    },
    saveSingleplayerState(saveId: string, nextGameState: GameState) {
      if (save.saveId !== saveId) throw new Error(`Unknown save ${saveId}`);
      save = { ...save, gameState: structuredClone(nextGameState) };
      return save;
    },
    listSaves() {
      return [
        {
          saveId: save.saveId,
          name: save.name,
          status: save.status,
          createdAt: save.createdAt,
          updatedAt: save.updatedAt,
        },
      ];
    },
    createSave() {
      throw new Error("Not implemented in test persistence.");
    },
    createFreshSeasonOneSave() {
      throw new Error("Not implemented in test persistence.");
    },
    cloneSave() {
      throw new Error("Not implemented in test persistence.");
    },
    activateSave(saveId: string) {
      return save.saveId === saveId ? save : null;
    },
  } as unknown as PersistenceService;
}

/** Kader auf die Pflichtzahl beider Disziplinen auffuellen — sonst greift eine andere Sperre. */
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

function baueStandMitAufstellungen() {
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

  const persistence = createInMemoryPersistence(gameState);
  const scope = {
    saveId: SAVE_ID,
    seasonId: gameState.season.id,
    matchdayId: gameState.matchdayState.matchdayId,
  };
  applyAiLegacyLineupBatchLocally(
    { ...scope, dryRun: false, includeWarningTeams: true, overwriteExisting: true },
    persistence,
  );
  return { persistence, scope };
}

/** Genau der Zustand nach D1: der Spieler hat sich AN DIESEM Spieltag verletzt. */
function verletzeInD1(gameState: GameState, teamId: string, playerId: string, matchdayId: string) {
  gameState.seasonState.playerAvailabilityState = [
    ...(gameState.seasonState.playerAvailabilityState ?? []).filter(
      (entry) => !(entry.playerId === playerId && entry.teamId === teamId),
    ),
    {
      playerId,
      teamId,
      fatigue: 62.4,
      injuryStatus: "injured",
      injuredAtSeasonId: gameState.season.id,
      injuredAtMatchdayId: matchdayId,
      injuryReason: "fatigue_over_30_after_matchday_use",
    },
  ];
}

describe("Verletzung in D1 blockiert die Wertung von D2 nicht", () => {
  it("die Wertung des Spieltags meldet keine fehlenden Disziplinwerte mehr", () => {
    const { persistence, scope } = baueStandMitAufstellungen();
    const gameState = persistence.getSaveById(SAVE_ID)!.gameState;

    // Den Spieler nehmen, der wirklich in D1 aufgestellt ist — sonst prueft der Test nichts.
    const draft = (gameState.seasonState.lineupDrafts ?? []).find(
      (entry) => entry.matchdayId === scope.matchdayId && entry.entries.some((slot) => slot.disciplineSide === "d1"),
    );
    expect(draft, "Es muss eine D1-Aufstellung geben, sonst laeuft der Test ins Leere.").toBeTruthy();
    const d1Slot = draft!.entries.find((slot) => slot.disciplineSide === "d1")!;

    verletzeInD1(gameState, draft!.teamId, d1Slot.playerId, scope.matchdayId);
    persistence.saveSingleplayerState(SAVE_ID, gameState);

    const nachher = persistence.getSaveById(SAVE_ID)!.gameState;
    // Gegenprobe: Die Sperre selbst greift — genau darum geht es ja.
    expect(getPlayerAvailabilityView(nachher, d1Slot.playerId, draft!.teamId, scope.matchdayId).isUnavailable).toBe(
      true,
    );

    const contexts = nachher.teams.map((team) => {
      const result = loadLocalLegacyLineupContextFromGameState(nachher, { ...scope, teamId: team.teamId });
      if (!result.ok) throw new Error(`${team.teamId}: ${result.errors.join(" | ")}`);
      return result.context;
    });
    const preview = buildLegacyMatchdayResolvePreview(contexts);

    expect(preview.missingScores).toEqual([]);
    expect(preview.status).not.toBe("missing_scores");
  });

  it("der Verletzte faellt aus der AUSWAHL, behaelt aber seinen Disziplinwert", () => {
    const { persistence, scope } = baueStandMitAufstellungen();
    const gameState = persistence.getSaveById(SAVE_ID)!.gameState;
    const draft = (gameState.seasonState.lineupDrafts ?? []).find(
      (entry) => entry.matchdayId === scope.matchdayId && entry.entries.some((slot) => slot.disciplineSide === "d1"),
    )!;
    const d1Slot = draft.entries.find((slot) => slot.disciplineSide === "d1")!;

    verletzeInD1(gameState, draft.teamId, d1Slot.playerId, scope.matchdayId);
    persistence.saveSingleplayerState(SAVE_ID, gameState);
    const nachher = persistence.getSaveById(SAVE_ID)!.gameState;

    const result = loadLocalLegacyLineupContextFromGameState(nachher, { ...scope, teamId: draft.teamId });
    expect(result.ok).toBe(true);
    const context = result.ok ? result.context : null;

    // Aufstellen: nein.
    expect(context!.activePlayers.some((player) => player.playerId === d1Slot.playerId)).toBe(false);
    // Werten: ja — und zwar fuer die Disziplin, in der er gestanden hat.
    expect(
      context!.disciplineScores.some(
        (score) => score.playerId === d1Slot.playerId && score.disciplineId === d1Slot.disciplineId,
      ),
    ).toBe(true);
  });
});
