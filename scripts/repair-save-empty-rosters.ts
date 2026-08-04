/* eslint-disable no-console */
/**
 * Save-Reparatur: holt den Liga-Setup-Draft fuer einen Save nach, dessen Teams (teilweise oder
 * vollstaendig) mit LEEREN Kadern zurueckblieben — der Fall, wenn der Whole-League-Draft beim
 * Anlegen nie lief (der urspruengliche Koop-Bug, siehe lib/room/room-store.ts / `startRoom`) oder
 * mittendrin abbrach.
 *
 * Nutzt DENSELBEN Draft wie ein frischer Save (`lib/game/league-setup-draft-service.ts`,
 * `repairLeagueSetupEmptyRosters`) — hier synchron statt im Hintergrund, weil ein Skript-Aufruf
 * (anders als eine HTTP-Route hinter einem Proxy) auf die ~40s einfach warten kann.
 *
 * IDEMPOTENT + NICHT-DESTRUKTIV: nur Teams mit GENAU 0 Roster-Eintraegen werden gedraftet. Ein
 * Team mit auch nur einem Spieler (verkauft/gekauft/manuell zusammengestellt) bleibt unangetastet
 * — Kasse, Vertraege, Transferhistorie stehen bei ihm exakt so, wie sie waren. Ein wiederholter
 * Aufruf auf einem bereits reparierten Save ist ein No-Op.
 *
 * Nutzung:
 *   npm run save:repair-empty-rosters -- --save-id <id> --dry-run   # nur anzeigen, nichts speichern
 *   npm run save:repair-empty-rosters -- --save-id <id>             # tatsaechlich draften + speichern
 *   npm run save:repair-empty-rosters                               # aktiver Save, Dry-Run (Standard!)
 *   npm run save:repair-empty-rosters -- --apply                    # aktiver Save, wirklich anwenden
 */
import { loadEnvConfig } from "@next/env";

import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { repairLeagueSetupEmptyRosters } from "@/lib/game/league-setup-draft-service";

loadEnvConfig(process.cwd());

type Options = { saveId?: string; apply?: boolean };

function parseArgs(argv: string[]): Options {
  const options: Options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--apply") {
      options.apply = true;
      continue;
    }
    // --dry-run ist der STANDARD (sicherer Default fuer ein Skript, das echte Spielstaende
    // anfasst) — das Flag wird trotzdem akzeptiert, damit es explizit hingeschrieben werden kann.
    if (arg === "--dry-run") {
      options.apply = false;
      continue;
    }
    if (arg === "--save-id" && argv[index + 1]) {
      options.saveId = argv[++index];
    }
  }
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const dryRun = !options.apply;
  const persistence = createPersistenceService();
  const save = options.saveId ? persistence.getSaveById(options.saveId) : persistence.getActiveSave();

  if (!save) {
    console.error(`Kein Save gefunden${options.saveId ? ` fuer --save-id ${options.saveId}` : ""}.`);
    process.exit(1);
  }

  console.log(`Save: ${save.saveId} (${save.name}) · Status: ${save.status}`);
  console.log(
    `Saison: ${save.gameState.season.id} · Spieltag: ${save.gameState.season.currentMatchday} · ` +
      `leagueSetupStatus vorher: ${save.gameState.seasonState.leagueSetupStatus ?? "—"}`,
  );

  const result = await repairLeagueSetupEmptyRosters({ persistence, saveId: save.saveId, dryRun });

  if (result.emptyTeamIds.length === 0) {
    console.log(`Nichts zu tun — alle ${result.teamsTotal} Teams haben bereits einen Kader.`);
    return;
  }

  console.log(
    `${result.emptyTeamIds.length} von ${result.teamsTotal} Teams ohne Kader ` +
      `(${result.teamsAlreadyFilled} bereits befuellt): ${result.emptyTeamIds.join(", ")}`,
  );
  console.log((dryRun ? "TROCKENLAUF — geplant" : "AUSGEFUEHRT") + ":");
  for (const team of result.plan) {
    console.log(
      `  ${team.teamCode.padEnd(6)} ${team.teamName.padEnd(28)} ${team.rosterBefore} -> ${team.rosterAfter}` +
        ` Spieler (Ziel-Minimum ${team.targetRosterMin ?? "—"}, ${team.plannedPicks} Picks)`,
    );
  }

  if (result.warnings.length > 0) {
    console.warn(`ACHTUNG: ${result.warnings.length} Team(s) blieben unter Mindestkader oder blockiert:`);
    for (const warning of result.warnings) {
      console.warn(`  ${warning.teamId} (${warning.teamName}): ${warning.rosterAfter}/${warning.targetMin} — ${warning.status}`);
    }
  }

  if (dryRun) {
    console.log("Dry run — nichts gespeichert. Mit --apply tatsaechlich draften.");
    return;
  }

  console.log(`leagueSetupStatus: ${result.leagueSetupStatusBefore ?? "—"} -> ${result.leagueSetupStatusAfter ?? "—"}`);
  console.log("Save gespeichert. Die betroffenen Teams haben jetzt einen Kader.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
