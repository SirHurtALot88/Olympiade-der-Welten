/* eslint-disable no-console */
/**
 * Stellt Teams zurueck auf KI, die faelschlich als Spieler-Teams gefuehrt werden.
 *
 * GEMELDET: „und wieso ist M-S auch als mein team getaggt? Das ist ein AI Team!!! da ist irgendwas
 * durcheinander geraten durch das season ende"
 *
 * URSACHE (behoben in `lib/ai/ai-preseason-manual-team-guard.ts`): der Schutz fuer Spieler-Teams
 * filterte auf `humanControlled !== false` — was auch fuer `undefined` wahr ist — und SCHRIEB
 * seine Annahme zurueck. Ein Team, dessen Flag unterwegs verlorenging, wurde damit dauerhaft zum
 * Spieler-Team. Der Code ist repariert; dieses Skript raeumt auf, was in bestehenden Spielstaenden
 * haengengeblieben ist.
 *
 * ERKENNUNGSMERKMAL — und der Grund, warum das Skript nicht raten muss:
 * `displayLabel: "AI"` wird ausschliesslich zusammen mit `controlMode: "ai"` geschrieben
 * (`team-control-settings.ts`). Beim Zusammenfuehren bleibt die Beschriftung stehen, waehrend der
 * Modus neu abgeleitet wird. Ein Team mit `displayLabel: "AI"` UND `controlMode: "manual"` ist
 * also nachweislich umgekippt — kein Spieler-Team traegt diese Kombination.
 *
 * Teams, die der Spieler wirklich fuehrt, tragen eine echte Beschriftung (z. B. „Chris") und
 * bleiben unangetastet.
 *
 * ES WIRD NICHTS GESCHRIEBEN, solange `--apply` fehlt.
 *
 * Nutzung:
 *   npx tsx scripts/repair-team-control-drift.ts                 # nur Bericht (aktiver Save)
 *   npx tsx scripts/repair-team-control-drift.ts --save <saveId>
 *   npx tsx scripts/repair-team-control-drift.ts --apply         # SCHREIBT (Backup vorher)
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import { createPersistenceService } from "@/lib/persistence/persistence-service";
import type { GameState } from "@/lib/data/olyDataTypes";
import fs from "node:fs";
import path from "node:path";

function parseArgs(argv: string[]) {
  let saveId: string | null = null;
  let apply = false;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--apply") apply = true;
    else if (argv[i] === "--save") saveId = argv[++i] ?? null;
  }
  return { saveId, apply };
}

async function main() {
  const { saveId: saveIdArg, apply } = parseArgs(process.argv.slice(2));
  const persistence = createPersistenceService();
  const saveId = saveIdArg ?? persistence.getActiveSave()?.saveId ?? null;
  if (!saveId) {
    console.error("Kein Spielstand angegeben und kein aktiver gefunden. Bitte --save <saveId> nutzen.");
    process.exit(1);
  }
  const save = persistence.getSaveById(saveId);
  if (!save) {
    console.error(`Spielstand nicht gefunden: ${saveId}`);
    process.exit(1);
  }

  const gameState = save.gameState;
  const settings = gameState.seasonState.teamControlSettings ?? {};

  console.log(`\nSpielstand : ${saveId}`);
  console.log(`Phase      : ${gameState.gamePhase ?? "?"}\n`);

  const alsSpielerGefuehrt = Object.values(settings).filter((entry) => entry?.controlMode === "manual");
  console.log("Als Spieler-Team gefuehrt:");
  for (const entry of alsSpielerGefuehrt) {
    const team = gameState.teams.find((t) => t.teamId === entry.teamId);
    console.log(
      `  ${entry.teamId.padEnd(5)} ${(team?.name ?? "?").padEnd(24)} Beschriftung „${entry.displayLabel ?? "—"}"` +
        `  ownerSlot=${entry.ownerSlot ?? "—"}`,
    );
  }

  // Die eindeutige Signatur des Umkippens (siehe Kopf): „AI" beschriftet, aber manuell gefuehrt.
  const umgekippt = alsSpielerGefuehrt.filter((entry) => entry.displayLabel === "AI");

  if (umgekippt.length === 0) {
    console.log("\nKein umgekipptes Team gefunden — nichts zu tun.");
    return;
  }

  console.log(`\n${"=".repeat(72)}`);
  console.log(`ZURUECK AUF KI — ${umgekippt.length} Team(s)`);
  console.log("=".repeat(72));
  for (const entry of umgekippt) {
    const team = gameState.teams.find((t) => t.teamId === entry.teamId);
    console.log(`  ${entry.teamId}  ${team?.name ?? "?"}  (Beschriftung „AI", aber controlMode „manual")`);
  }

  if (!apply) {
    console.log(`\n${"-".repeat(72)}\nNUR BERICHT — es wurde nichts geschrieben.\n${"-".repeat(72)}`);
    return;
  }

  const backupDir = path.join(process.cwd(), "data", "save-backups");
  fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(backupDir, `${saveId}-vor-control-fix-${Date.now()}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(save, null, 2));
  console.log(`\nBackup: ${backupPath}`);

  const ids = new Set(umgekippt.map((entry) => entry.teamId));
  const naechster: GameState = {
    ...gameState,
    teams: gameState.teams.map((team) => (ids.has(team.teamId) ? { ...team, humanControlled: false } : team)),
    seasonState: {
      ...gameState.seasonState,
      teamControlSettings: Object.fromEntries(
        Object.entries(settings).map(([teamId, entry]) =>
          ids.has(teamId)
            ? [
                teamId,
                {
                  ...entry,
                  controlMode: "ai",
                  ownerId: "ai",
                  ownerSlot: "ai",
                  // Die Vorschau-Schalter gehoeren zum KI-Modus (siehe
                  // `createDefaultTeamControlSettings`) — ohne sie waere das Team zwar wieder KI,
                  // wuerde aber weiterhin nichts vorbereiten.
                  aiLineupPreviewEnabled: true,
                  aiTransferPreviewEnabled: true,
                  aiSellPreviewEnabled: true,
                },
              ]
            : [teamId, entry],
        ),
      ),
    },
  };

  persistence.saveSingleplayerState(saveId, naechster);
  console.log(`\nERLEDIGT — ${ids.size} Team(s) zurueck auf KI: ${[...ids].join(", ")}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
