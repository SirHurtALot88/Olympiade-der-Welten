/* eslint-disable no-console */
/**
 * FORM AN EINER SPIELSTAND-KOPIE NACHFUEHREN (18.11., fuer Sichtpruefung und Messung).
 *
 * Ein Live-Abbild von vor der Form-Einfuehrung hat keine `playerFormState`. Dieses Skript fuehrt die
 * ECHTE Fortschreibung (`advancePlayerFormState`) fuer jeden schon gewerteten Spieltag der laufenden
 * Saison in Reihenfolge nach — aus den gebuchten `playerDisciplinePerformances`, ohne etwas zu
 * erfinden — und speichert das Ergebnis in der Datenbank, auf die `OLY_APP_SQLITE_PATH` zeigt.
 * NUR AUF EINE KOPIE ZEIGEN LASSEN, nie auf den Server-Stand.
 *
 *   OLY_APP_SQLITE_PATH=/pfad/kopie.sqlite npx tsx scripts/form-am-save-abbild-nachfuehren.ts [--save <id>]
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import { advancePlayerFormState } from "@/lib/morale/form-moral-modifikator";
import { createPersistenceService } from "@/lib/persistence/persistence-service";

async function main() {
  const idx = process.argv.indexOf("--save");
  const gewaehlt = idx >= 0 ? process.argv[idx + 1] : null;
  const persistence = createPersistenceService();
  const save = gewaehlt ? persistence.getSaveById(gewaehlt) : persistence.getActiveSave();
  if (!save) {
    console.error("Kein Spielstand gefunden.");
    process.exit(2);
    return;
  }
  let gameState = save.gameState;
  const ergebnisse = (gameState.seasonState.matchdayResults ?? []).filter((e) => e.seasonId === gameState.season.id);
  const reihenfolge = gameState.season.matchdayIds ?? [];
  const tage = [...new Set(ergebnisse.map((e) => e.matchdayId))].sort((a, b) => reihenfolge.indexOf(a) - reihenfolge.indexOf(b));
  for (const tag of tage) {
    gameState = { ...gameState, playerFormState: advancePlayerFormState(gameState, tag) };
  }
  persistence.saveSingleplayerState(save.saveId, gameState);
  const mit = (gameState.playerFormState ?? []).filter((z) => (z.verlauf?.length ?? 0) > 0).length;
  console.log(`Spielstand ${save.saveId} (${save.name}): ${tage.length} Spieltage nachgefuehrt, ${mit} Spieler mit Verlauf.`);
}

main().catch((fehler) => {
  console.error(fehler);
  process.exit(1);
});
