import { createPersistenceService } from "@/lib/persistence/persistence-service";

const SMOKE_SAVE_NAME = "CI Gameplay Smoke Save";
const SMOKE_SCENARIO_TYPE = "gameplay_smoke_readonly";

function main() {
  const persistence = createPersistenceService();
  const bootstrap = persistence.bootstrapSingleplayerSave().save;
  const existing = persistence
    .listSaves()
    .find((save) => save.scenarioMeta?.scenarioType === SMOKE_SCENARIO_TYPE);

  const smokeSave =
    (existing ? persistence.getSaveById(existing.saveId) : null) ??
    persistence.createScenarioSnapshot({
      sourceSaveId: bootstrap.saveId,
      name: SMOKE_SAVE_NAME,
      status: "active",
      scenarioMeta: {
        scenarioType: SMOKE_SCENARIO_TYPE,
        label: SMOKE_SAVE_NAME,
        description: "Dedicated read-only gameplay smoke save for CI.",
        createdAt: new Date().toISOString(),
        sourceSaveId: bootstrap.saveId,
        isStableTestPoint: true,
        allowTestWrites: false,
        containsFinalStandings: bootstrap.gameState.scenarioMeta?.containsFinalStandings ?? false,
        containsSeasonHistory: bootstrap.gameState.scenarioMeta?.containsSeasonHistory ?? false,
        activeSeasonId: bootstrap.gameState.season.id,
        activeMatchday: bootstrap.gameState.season.currentMatchday,
        gamePhase: bootstrap.gameState.gamePhase ?? "season_active",
      },
    });

  persistence.activateSave(smokeSave.saveId);

  console.log(
    JSON.stringify(
      {
        ok: true,
        saveId: smokeSave.saveId,
        name: smokeSave.name,
        scenarioType: SMOKE_SCENARIO_TYPE,
        seasonId: smokeSave.gameState.season.id,
        matchdayId: smokeSave.gameState.matchdayState.matchdayId,
      },
      null,
      2,
    ),
  );
}

main();
