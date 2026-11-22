// Fuellt in einer Kopie aus ...-bau.ts auch die Einsatzliste des Mensch-Teams (KI-Batch laeuft nur ueber KI-Teams):
// Besitz kurz auf KI, Batch, Besitz zurueck. Aufruf: OLY_APP_SQLITE_PATH=<kopie> npx tsx <skript>
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { applyAiLegacyLineupBatchLocally } from "@/lib/ai/ai-legacy-lineup-batch-apply-service";
import { applyGameModeOwnership } from "@/lib/foundation/team-control-settings";

const persistence = createPersistenceService();
const saveId = process.argv[2]!;
const teamId = process.argv[3]!;
const setze = (mensch: boolean) => persistence.saveSingleplayerState(saveId, applyGameModeOwnership(persistence.getSaveById(saveId)!.gameState, { saveMode: "solo_1", chrisTeamIds: mensch ? [teamId] : [], frankyTeamIds: [] }));
setze(false);
const gs = persistence.getSaveById(saveId)!.gameState;
const r = applyAiLegacyLineupBatchLocally({ saveId, seasonId: gs.season.id, matchdayId: gs.matchdayState.matchdayId, dryRun: false, includeWarningTeams: true, overwriteExisting: true }, persistence);
setze(true);
console.log("gefuellt", gs.matchdayState.matchdayId, JSON.stringify(r).slice(0, 300));
process.exit(0);
