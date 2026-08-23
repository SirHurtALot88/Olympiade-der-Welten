/* eslint-disable no-console */
/**
 * HAENGT DER FLOW BEI „TRAINING PRUEFEN"? — die Luecke, die ihn aufhaelt, sichtbar machen.
 *
 * Chris hat es dreimal gemeldet (`j53iox`, `hnbng4`, und am 23.08. „der training prüfen button
 * hängt immernoch"). Ein einziger Kaderspieler ohne Trainingsmodus haelt den ganzen Flow auf, und
 * am Spielstand sieht man ihm das nicht an — dieses Skript sagt, wer es ist.
 *
 * ES IST AUCH DER BELEG FUER DIE LADEWEG-HEILUNG. Gegen dasselbe Abbild gefahren meldet es ohne
 * `applyDefaultTrainingFieldsToRosteredPlayers` in `materializePersistedSave` elf Spieler in drei
 * Spielstaenden (V-W: Johanna; T-G: acht; C-C: zwei) und mit ihr keinen einzigen. Ein Testfall
 * dafuer stand kurz in `tests/trainingsmodus-heilt-beim-laden.test.ts` und ist wieder raus: er
 * blieb in der Gegenprobe gruen und belegte damit nichts.
 *
 * Nutzung:
 *   OLY_APP_SQLITE_PATH=/pfad/zur/kopie.sqlite npx tsx scripts/pruefe-trainingsmodus-luecken.ts
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
import type { GameState } from "@/lib/data/olyDataTypes";
import { findPlayersWithoutTrainingMode } from "@/lib/foundation/team-training-status";
import { createPersistenceService } from "@/lib/persistence/persistence-service";

const p = createPersistenceService();
let luecken = 0;
let geprueft = 0;

for (const eintrag of p.listSaves()) {
  const gs = p.getSaveById(eintrag.saveId)?.gameState as GameState | undefined;
  if (!gs?.teams?.length) continue;
  const kuerzel = String(eintrag.saveId).slice(-6);
  for (const team of gs.teams) {
    if (!(team as { humanControlled?: boolean }).humanControlled) continue;
    geprueft += 1;
    const lage = findPlayersWithoutTrainingMode(gs, team.teamId);
    if (lage.status !== "incomplete") continue;
    luecken += lage.missingCount;
    console.log(
      `${kuerzel}  ${team.teamId}  ${lage.missingCount} ohne Trainingsmodus — ${lage.missingPlayerNames.join(", ")}` +
        (lage.missingCount > lage.missingPlayerNames.length ? " …" : ""),
    );
  }
}

console.log(
  luecken === 0
    ? `\nKeine Luecke — der Schritt „Training pruefen" haelt in keinem der ${geprueft} Menschen-Teams auf.`
    : `\n${luecken} Spieler ohne Trainingsmodus in ${geprueft} geprueften Menschen-Teams.`,
);
