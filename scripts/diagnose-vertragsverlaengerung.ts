/* eslint-disable no-console */
/**
 * DIAGNOSE: warum laesst sich am Saisonende kein Vertrag verlaengern?
 * Nutzung: OLY_APP_SQLITE_PATH=/pfad/abbild.sqlite npx tsx scripts/diagnose-vertragsverlaengerung.ts [--save <id>]
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import { createPersistenceService } from "@/lib/persistence/persistence-service";
import {
  previewSeasonEndContracts,
  previewContractRenewalAction,
  hasSeasonEndContractTickApplied,
} from "@/lib/contracts/contract-renewal-service";
import { evaluateGamePhaseAction } from "@/lib/foundation/game-phase-action-policy";

async function main() {
  const argv = process.argv.slice(2);
  const i = argv.indexOf("--save");
  const saveId = i >= 0 ? argv[i + 1] : null;
  const persistence = createPersistenceService();
  const save = saveId ? persistence.getSaveById(saveId) : persistence.getActiveSave();
  if (!save) {
    console.error("Kein Spielstand.");
    process.exit(2);
    return;
  }
  console.log(`Spielstand : ${save.saveId} — ${save.name}`);
  console.log(`Phase      : ${save.gameState.gamePhase}`);
  console.log(`Saison     : ${save.gameState.season.id}, Spieltag ${save.gameState.matchdayState.matchdayId}`);

  const gate = evaluateGamePhaseAction(save.gameState, "renew_contract");
  console.log(`Phasen-Riegel: allowed=${gate.allowed} reason=${gate.reason}`);

  console.log(`Vertragsalterung gelaufen? ${hasSeasonEndContractTickApplied(save.gameState)}`);
  console.log(`preSeasonWorkflowLogs: ${(save.gameState.seasonState.preSeasonWorkflowLogs ?? []).length}`);
  for (const eintrag of (save.gameState.seasonState.preSeasonWorkflowLogs ?? []).slice(-6)) {
    console.log(`   Log: ${JSON.stringify(eintrag).slice(0, 200)}`);
  }

  const vorschau = previewSeasonEndContracts(save);
  console.log(`\nSaisonende-Vorschau: ${vorschau.rows.length} Zeilen`);
  console.log(`  auslaufend (statusBeforeTick=expiring): ${vorschau.expiringCount}`);
  console.log(`  nach dem Tick vertragslos             : ${vorschau.outOfContractAfterTickCount}`);
  console.log(`  manuelle Entscheidungen noetig        : ${vorschau.manualDecisionCount}`);

  const menschlich = vorschau.rows.filter((row) => row.controlMode === "manual");
  console.log(`\nZeilen manuell gefuehrter Teams: ${menschlich.length}`);
  for (const row of menschlich.slice(0, 6)) {
    const einzeln = previewContractRenewalAction({
      save,
      teamId: row.teamId,
      playerId: row.playerId,
      action: "renew",
    });
    console.log(
      `  ${row.teamId} ${row.playerName}: LZ ${row.contractLengthBefore}->${row.contractLengthAfterTick}` +
        ` status ${row.statusBeforeTick}->${row.statusAfterTick}` +
        ` | Einzel-Vorschau ok=${einzeln.ok} blocker=${JSON.stringify(einzeln.blockingReasons)}`,
    );
  }
}

void main();
