/* eslint-disable no-console */
/**
 * Save-Reparatur: löst einen Spielstand, der fälschlich in `preseason_management`
 * festhängt und dadurch bei Saison 1 / Spieltag 1 nicht zur Arena kommt
 * (`phase_blocked:set_lineup:preseason_management`).
 *
 * Ursache: `new-game-setup-service` hat neue Spiele mit `gamePhase`
 * "preseason_management" angelegt — aus dieser Phase führt für ein brandneues
 * Spiel (ohne abgeschlossene Vorsaison) kein Weg heraus. Neue Spiele starten
 * jetzt korrekt in "season_active" (offener Spieltag 1 = Saisonstart-Setup:
 * Kaufen/Training/Sponsor bleiben über die Early-Setup-Gates erlaubt, aber
 * Einsatzliste + Arena sind freigeschaltet). Dieses Script zieht bestehende,
 * bereits gestartete Saves auf denselben Stand.
 *
 * Sicherheitscheck: greift NUR, wenn der Spielstand am Saison-/Spieltag-Anfang
 * steht (aktueller Spieltag noch nicht aufgelöst, kein Ergebnis vorhanden) —
 * ein laufendes Vorsaison-Ende (echte Saison-zu-Saison-Übergangsphase) wird
 * NICHT angefasst.
 *
 * Nutzung:
 *   npx tsx scripts/repair-save-unstick-preseason.ts --save-id <saveId>
 *   npx tsx scripts/repair-save-unstick-preseason.ts               # aktiver Save
 *   npx tsx scripts/repair-save-unstick-preseason.ts --dry-run     # nur anzeigen
 */
import { loadEnvConfig } from "@next/env";

import { createPersistenceService } from "@/lib/persistence/persistence-service";
import type { GamePhase } from "@/lib/data/olyDataTypes";

loadEnvConfig(process.cwd());

type Options = { saveId?: string; dryRun?: boolean };

function parseArgs(argv: string[]): Options {
  const options: Options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (arg === "--save-id" && argv[index + 1]) {
      options.saveId = argv[++index];
    }
  }
  return options;
}

const STUCK_PHASES = new Set<GamePhase>([
  "preseason_management",
  "transfer_sell_phase",
  "transfer_buy_phase",
  "lineup_setup",
]);

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const persistence = createPersistenceService();
  const save = options.saveId ? persistence.getSaveById(options.saveId) : persistence.getActiveSave();

  if (!save) {
    console.error(`Kein Save gefunden${options.saveId ? ` für --save-id ${options.saveId}` : ""}.`);
    process.exit(1);
  }

  const gs = save.gameState;
  const phase = gs.gamePhase ?? "season_active";
  const currentMatchday = gs.season.currentMatchday ?? 1;
  const matchdayId = gs.matchdayState?.matchdayId ?? null;
  const matchdayResolved = gs.matchdayState?.status === "resolved";
  const hasResult = (gs.seasonState.matchdayResults ?? []).some(
    (result) => result.seasonId === gs.season.id && result.matchdayId === matchdayId,
  );

  console.log(`Save: ${save.saveId} (${save.name})`);
  console.log(`Phase: ${phase} · Season: ${gs.season.id} · Spieltag: ${currentMatchday} (${matchdayId ?? "—"})`);

  if (phase === "season_active") {
    console.log("Bereits season_active — nichts zu tun.");
    return;
  }
  if (!STUCK_PHASES.has(phase)) {
    console.log(`Phase ${phase} ist kein bekannter Hänger — sicherheitshalber unangetastet.`);
    return;
  }
  if (currentMatchday > 1 || matchdayResolved || hasResult) {
    console.warn(
      "WARN: Spielstand ist NICHT am Saison-/Spieltag-Anfang (Spieltag>1 oder bereits aufgelöst/mit Ergebnis). " +
        "Kein automatischer Phasen-Wechsel — bitte manuell prüfen.",
    );
    return;
  }

  const nextGameState = {
    ...gs,
    gamePhase: "season_active" as GamePhase,
    scenarioMeta: gs.scenarioMeta
      ? { ...gs.scenarioMeta, gamePhase: "season_active" as GamePhase }
      : gs.scenarioMeta,
  };

  console.log("→ gamePhase: preseason_management → season_active (Saisonstart-Setup, Einsatzliste + Arena frei).");

  if (options.dryRun) {
    console.log("Dry run — nichts gespeichert.");
    return;
  }

  persistence.saveSingleplayerState(save.saveId, nextGameState, { status: save.status });
  console.log("Save gespeichert. Du kannst jetzt die Einsatzliste setzen und zur Arena.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
