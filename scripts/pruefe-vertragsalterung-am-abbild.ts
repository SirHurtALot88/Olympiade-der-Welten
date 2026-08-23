/* eslint-disable no-console */
/**
 * PRUEFUNG: greift die automatische Vertragsalterung auf einem echten Spielstand?
 * Nutzung: OLY_APP_SQLITE_PATH=/pfad/abbild.sqlite npx tsx scripts/pruefe-vertragsalterung-am-abbild.ts [--save <id>]
 *
 * Schreibt NICHTS: der Tick wird ueber `computeSeasonEndContractTick` nur GERECHNET, das Ergebnis
 * bleibt im Speicher. Das Abbild ist ohnehin eine Kopie, aber eine Messung, die den Messgegenstand
 * veraendert, taugt beim zweiten Lauf nichts mehr.
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import {
  computeSeasonEndContractTick,
  hasSeasonEndContractTickApplied,
  normalizeRosterContractStatus,
  previewContractRenewalAction,
} from "@/lib/contracts/contract-renewal-service";
import { isSeasonEndPhase } from "@/lib/season/season-transition-chain";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import type { GameState } from "@/lib/data/olyDataTypes";

function verteilung(gameState: GameState) {
  const nachStatus = new Map<string, number>();
  for (const eintrag of gameState.rosters) {
    const status = normalizeRosterContractStatus(eintrag);
    nachStatus.set(status, (nachStatus.get(status) ?? 0) + 1);
  }
  return [...nachStatus.entries()].sort((links, rechts) => rechts[1] - links[1]);
}

async function main() {
  const argv = process.argv.slice(2);
  const index = argv.indexOf("--save");
  const saveId = index >= 0 ? argv[index + 1] : null;
  const persistence = createPersistenceService();
  const save = saveId ? persistence.getSaveById(saveId) : persistence.getActiveSave();
  if (!save) {
    console.error("Kein Spielstand.");
    process.exit(2);
    return;
  }

  console.log(`Spielstand : ${save.saveId} — ${save.name}`);
  console.log(`Phase      : ${save.gameState.gamePhase} (Saisonende-Fenster: ${isSeasonEndPhase(save.gameState.gamePhase)})`);
  console.log(`Alterung gelaufen: ${hasSeasonEndContractTickApplied(save.gameState)}`);
  console.log(`VORHER : ${JSON.stringify(verteilung(save.gameState))}`);

  const alterung = computeSeasonEndContractTick(save);
  console.log(`Tick angewandt: ${alterung.applied} · freigegeben ${alterung.releasedPlayers} · verlaengert ${alterung.renewedPlayers}`);
  if (!alterung.applied) {
    return;
  }
  console.log(`NACHHER: ${JSON.stringify(verteilung(alterung.gameState))}`);

  // Und die eigentliche Frage: laesst sich danach ueberhaupt etwas verlaengern, und auf wie lange?
  const gealtert = { ...save, gameState: alterung.gameState };
  const menschlich = gealtert.gameState.rosters.filter(
    (eintrag) => normalizeRosterContractStatus(eintrag) === "renewal_pending",
  );
  console.log(`\nAuf Entscheidung wartend (renewal_pending): ${menschlich.length}`);
  for (const eintrag of menschlich.slice(0, 4)) {
    const name = gealtert.gameState.players.find((spieler) => spieler.id === eintrag.playerId)?.name ?? eintrag.playerId;
    const zeile = [1, 2, 3].map((laenge) => {
      const vorschau = previewContractRenewalAction({
        save: gealtert,
        teamId: eintrag.teamId,
        playerId: eintrag.playerId,
        action: "renew",
        contractLength: laenge,
      });
      return `LZ${laenge}=${vorschau.ok ? "ok" : vorschau.blockingReasons[0] ?? "blockiert"}`;
    });
    console.log(`  ${eintrag.teamId} ${name}: LZ ${eintrag.contractLength} status ${eintrag.contractStatus} · ${zeile.join(" ")}`);
  }
}

void main();
