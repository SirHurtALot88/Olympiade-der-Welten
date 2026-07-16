import { applyGameModeOwnership, deriveChrisFrankyTeamIdsFromSettings } from "@/lib/foundation/team-control-settings";
import { createPersistenceService } from "@/lib/persistence/persistence-service";

type RepairOptions = {
  saveId?: string;
  chrisTeamId?: string;
  dryRun?: boolean;
};

function parseArgs(argv: string[]): RepairOptions {
  const options: RepairOptions = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (arg === "--save-id" && argv[index + 1]) {
      options.saveId = argv[++index];
      continue;
    }
    if (arg === "--team" && argv[index + 1]) {
      options.chrisTeamId = argv[++index];
    }
  }
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const persistence = createPersistenceService();
  const activeSave = options.saveId ? persistence.getSaveById(options.saveId) : persistence.getActiveSave();

  if (!activeSave) {
    console.error("Kein Save gefunden.");
    process.exit(1);
  }

  const existing = deriveChrisFrankyTeamIdsFromSettings(
    activeSave.gameState.teams,
    activeSave.gameState.seasonState.teamControlSettings ?? {},
  );
  const chrisTeamIds = options.chrisTeamId
    ? [options.chrisTeamId]
    : existing.chrisTeamIds.length === 1
      ? existing.chrisTeamIds
      : [activeSave.gameState.seasonState.newGameFlow?.selectedTeamId ?? existing.chrisTeamIds[0] ?? "M-M"].filter(Boolean);

  const nextGameState = applyGameModeOwnership(activeSave.gameState, {
    saveMode: "solo_1",
    chrisTeamIds,
    frankyTeamIds: [],
  });

  const manualTeams = nextGameState.teams.filter((team) => team.humanControlled).map((team) => team.teamId);
  console.log(`Save: ${activeSave.saveId} (${activeSave.name})`);
  console.log(`Solo manual team(s): ${manualTeams.join(", ") || "—"}`);
  console.log(`AI teams: ${nextGameState.teams.length - manualTeams.length}`);

  if (options.dryRun) {
    console.log("Dry run — nichts gespeichert.");
    return;
  }

  persistence.saveSingleplayerState(activeSave.saveId, nextGameState, { status: activeSave.status });
  console.log("Save repariert (solo_1 ownership).");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
