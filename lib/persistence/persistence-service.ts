import type { GameState, Team } from "@/lib/data/olyDataTypes";
import { createSaveGameState, loadFreshSeasonOneSeedData, loadSeedData } from "@/lib/data/dataAdapter";
import { applyChrisFrankyOwnershipToTeamControlSettings } from "@/lib/foundation/team-control-settings";
import { createSaveRepository } from "@/lib/persistence/save-repository";
import { withScenarioMeta } from "@/lib/persistence/scenario-meta";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";
import { formatGermanDateTime } from "@/lib/utils/format-datetime";

/** Every persisted write bumps from the stored version so optimistic locking stays consistent. */
export function withNextSaveVersion(gameState: GameState, storedSaveVersion: number | null | undefined): GameState {
  return {
    ...gameState,
    saveVersion: (storedSaveVersion ?? 0) + 1,
  };
}

const SINGLEPLAYER_SAVE_ID = "save-singleplayer-dev";
const SINGLEPLAYER_SAVE_NAME = "Singleplayer Foundation";

function createSaveId() {
  return `save-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createFreshSeasonOneSaveId() {
  return `fresh-season-1-${Date.now()}`;
}

/**
 * Welche Teams steuert der Spieler im NEUEN Spielstand selbst?
 *
 * Rangfolge, und jede Stufe ist eine echte Angabe — nichts davon ist geraten:
 *  1. was der Aufrufer ausdruecklich mitgibt (der Klub-Picker),
 *  2. sonst die Teams, die im gerade geladenen Stand `manual` sind,
 *  3. sonst nichts — dann liegt keine Angabe vor, und eine zu erfinden waere schlimmer als keine.
 *
 * Gefiltert wird gegen die Teams des NEUEN Standes: eine Kennung, die es dort nicht gibt, wuerde
 * eine Steuerung ins Leere schreiben.
 */
function resolveManualTeamIdsForNewSave(input: {
  angefragt?: string[] | null;
  vorlage: PersistedSaveGame | null;
  neueTeams: Team[];
}): string[] {
  const vorhanden = new Set(input.neueTeams.map((team) => team.teamId));
  const ausVorlage = Object.values(input.vorlage?.gameState.seasonState.teamControlSettings ?? {})
    .filter((setting) => setting?.controlMode === "manual")
    .map((setting) => setting.teamId);
  const kandidaten = input.angefragt?.length ? input.angefragt : ausVorlage;
  return [...new Set(kandidaten.filter((teamId) => vorhanden.has(teamId)))];
}

/** Env-gated (OLY_PERF_COUNT_SAVES=1) profiling counter for saveSingleplayerState cost. No behaviour change. */
const SAVE_PERF = { count: 0, ms: 0 };

export function createPersistenceService(): PersistenceService {
  const saveRepository = createSaveRepository();

  return {
    bootstrapSingleplayerSave() {
      const active = saveRepository.getActiveSave();
      if (active) {
        return {
          save: active,
          createdFromSeed: false,
        };
      }

      const seedData = loadSeedData();
      const saveSeed = createSaveGameState(SINGLEPLAYER_SAVE_ID, seedData);
      const save = saveRepository.createSaveFromSeed({
        saveId: saveSeed.saveId,
        name: SINGLEPLAYER_SAVE_NAME,
        status: "active",
        seedData,
      });

      return {
        save,
        createdFromSeed: true,
      };
    },
    getActiveSave(ownerId) {
      return saveRepository.getActiveSave(ownerId);
    },
    getSaveById(saveId) {
      if (saveId === "active" || saveId === "current") {
        return saveRepository.getActiveSave();
      }
      return saveRepository.getSaveById(saveId);
    },
    getSaveVersionMetadata(saveId) {
      return saveRepository.getSaveVersionMetadata(saveId);
    },
    saveSingleplayerState(saveId, gameState, input) {
      const perfCount = process.env.OLY_PERF_COUNT_SAVES === "1";
      const t0 = perfCount ? Number(process.hrtime.bigint()) : 0;
      const existing = saveRepository.getSaveById(saveId);
      const nextGameState = withNextSaveVersion(gameState, existing?.gameState.saveVersion);
      const result = saveRepository.saveGameState({
        saveId,
        status: input?.status ?? existing?.status,
        gameState: nextGameState,
      });
      if (perfCount) {
        SAVE_PERF.count += 1;
        SAVE_PERF.ms += (Number(process.hrtime.bigint()) - t0) / 1e6;
        if (SAVE_PERF.count % 25 === 0) {
          console.error(`[perf-saves] count=${SAVE_PERF.count} totalMs=${SAVE_PERF.ms.toFixed(0)} avgMs=${(SAVE_PERF.ms / SAVE_PERF.count).toFixed(0)}`);
        }
      }
      return result;
    },
    /**
     * EIN SPIELSTAND OHNE EIGENES TEAM IST KEINER.
     *
     * GEMELDET VON CHRIS: „wenn ich in settings hier mein team wähle soll das automatisch
     * konfiguriert werden dass AI die anderen teams übernimmt und nicht dass manual auf 0 bleibt
     * … ich wähle dort ein team aus aber dann wird für mich gepickt".
     *
     * BEFUND, an seinen Spielstaenden nachgemessen: alle fuenf ueber den Klub-Portfolio-Assistenten
     * angelegten (`new-game-…`) tragen manual=1/ai=31. Beide ueber DIESEN Weg angelegten
     * (`save-…`, „Neues Spiel …") tragen **manual=0/ai=32** — kein einziges Team gehoerte ihm.
     * Der Saatzustand kennt keinen Spieler, und hier stand nichts, was ihm eines zuwies.
     *
     * In den Team-Einstellungen liegen zwei Knoepfe mit fast gleichem Namen uebereinander:
     * „Neues Spiel erstellen" (der Assistent, richtig) und „Neues Spiel anlegen" (dieser Weg).
     * Wer den zweiten trifft, landet als Zuschauer in seiner eigenen Liga — die KI steuert alle
     * 32 Teams, und beim naechsten Spieltag „wird fuer einen gepickt".
     *
     * Deshalb: ohne ausdrueckliche Angabe uebernimmt der neue Stand das Team des GERADE GELADENEN
     * Standes. Das ist keine Raterei, sondern die einzige Angabe, die hier ueberhaupt vorliegt —
     * und sie trifft genau den Fall, ueber den Chris gestolpert ist. Findet sich auch so keine,
     * bleibt es beim Saatzustand: dann gibt es schlicht nichts zu uebernehmen.
     */
    createSave(name, ownerId, manualTeamIds) {
      // VOR dem Anlegen lesen: `createSaveFromSeed` schaltet bereits auf den neuen Stand um, und
      // der traegt naturgemaess noch keine eigene Steuerung. Danach gefragt, waere die Vorlage
      // der leere Neuling selbst — und die Uebernahme liefe ins Leere.
      const vorlage = saveRepository.getActiveSave(ownerId);
      const save = saveRepository.createSaveFromSeed({
        saveId: createSaveId(),
        name,
        status: "active",
        seedData: loadSeedData(),
        ownerId,
      });
      const eigeneTeams = resolveManualTeamIdsForNewSave({
        angefragt: manualTeamIds,
        vorlage,
        neueTeams: save.gameState.teams,
      });
      const gameState =
        eigeneTeams.length > 0
          ? {
              ...save.gameState,
              seasonState: {
                ...save.gameState.seasonState,
                teamControlSettings: applyChrisFrankyOwnershipToTeamControlSettings(
                  save.gameState.teams,
                  eigeneTeams,
                  [],
                  save.gameState.seasonState.teamControlSettings,
                ),
              },
            }
          : save.gameState;
      const manualSave = saveRepository.saveGameState({
        saveId: save.saveId,
        name: save.name,
        status: save.status,
        gameState: withScenarioMeta(gameState, {
          saveCategory: "manual",
        }),
      });

      return saveRepository.setActiveSave(manualSave.saveId, ownerId) ?? manualSave;
    },
    createFreshSeasonOneSave(input) {
      const status = input?.status ?? "active";
      const save = saveRepository.createSaveFromSeed({
        saveId: input?.saveId ?? createFreshSeasonOneSaveId(),
        name: input?.name ?? `Season 1 Teststart ${formatGermanDateTime(new Date())}`,
        status,
        seedData: loadFreshSeasonOneSeedData(),
        ownerId: input?.ownerId,
      });
      const taggedSave = saveRepository.saveGameState({
        saveId: save.saveId,
        name: save.name,
        status: save.status,
        gameState: withScenarioMeta(save.gameState, {
          scenarioType: "fresh_start",
          label: save.name,
          description: "Fresh Season-1 Startsave aus lokalem Seed.",
          saveCategory: "pre-season",
          isStableTestPoint: true,
        }),
      });

      if (status === "active" && input?.activate !== false) {
        return saveRepository.setActiveSave(taggedSave.saveId, input?.ownerId) ?? taggedSave;
      }

      return taggedSave;
    },
    cloneSave(sourceSaveId, name, ownerId) {
      const clone = saveRepository.cloneSave({
        sourceSaveId,
        saveId: createSaveId(),
        name,
        status: "active",
        ownerId,
      });
      const manualClone = saveRepository.saveGameState({
        saveId: clone.saveId,
        name: clone.name,
        status: clone.status,
        gameState: withScenarioMeta(clone.gameState, {
          saveCategory: "manual",
        }),
      });
      return saveRepository.setActiveSave(manualClone.saveId, ownerId) ?? manualClone;
    },
    createScenarioSnapshot(input) {
      const source = saveRepository.getSaveById(input.sourceSaveId);
      if (!source) {
        throw new Error(`Source save ${input.sourceSaveId} could not be found.`);
      }
      return saveRepository.createScenarioSnapshot({
        sourceSaveId: input.sourceSaveId,
        saveId: createSaveId(),
        name: input.name,
        status: input.status ?? "active",
        scenarioMeta: {
          ...input.scenarioMeta,
          sourceSaveId: input.scenarioMeta.sourceSaveId ?? input.sourceSaveId,
          saveCategory: input.scenarioMeta.saveCategory ?? "manual",
        },
        ownerId: input.ownerId,
      });
    },
    activateSave(saveId, ownerId) {
      return saveRepository.setActiveSave(saveId, ownerId);
    },
    listSaves() {
      return saveRepository.listSaves();
    },
    deleteSave(saveId) {
      return saveRepository.deleteSave(saveId);
    },
    deleteSaves(saveIds) {
      return saveRepository.deleteSaves(saveIds);
    },
  };
}
