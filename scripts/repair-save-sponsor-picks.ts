/* eslint-disable no-console */
/**
 * Save-Reparatur: lässt in einem bestehenden Spielstand ALLE KI-Teams ihren
 * Saison-Sponsor picken. Nötig für Saves, die VOR der Umstellung von
 * Liga-Preisgeld auf Sponsor-Einnahmen entstanden sind — dort steht bei den
 * KI-Teams noch „—" in der Sponsor-Spalte, weil nie ein Sponsor gewählt wurde.
 *
 * Ablauf (nichts erfunden — dieselbe Logik wie die Vorsaison):
 *   1. `ensureSeasonSponsorOffers` — erzeugt fehlende Sponsor-Angebote je Team.
 *   2. `chooseSponsorOfferForAiTeams` — jedes KI-Team (controlMode ≠ manual/passive
 *      und noch ohne laufenden Sponsorvertrag) nimmt sein bestes Angebot an.
 *
 * MANUELLE / menschlich gesteuerte Teams (z. B. dein eigenes) werden NICHT
 * automatisch gepickt — die Angebote liegen aber danach bereit, sodass du im
 * Sponsoren-Tab selbst auswählen kannst.
 *
 * Nutzung:
 *   npx tsx scripts/repair-save-sponsor-picks.ts --save-id <saveId>
 *   npx tsx scripts/repair-save-sponsor-picks.ts               # aktiver Save
 *   npx tsx scripts/repair-save-sponsor-picks.ts --dry-run     # nur anzeigen
 */
import { loadEnvConfig } from "@next/env";

import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { buildTeamControlSettingsMap } from "@/lib/foundation/team-control-settings";
import { getTeamSponsorContract } from "@/lib/sponsor/sponsor-offer-read";
import {
  chooseSponsorOfferForAiTeams,
  ensureSeasonSponsorOffers,
} from "@/lib/sponsor/sponsor-offer-service";

loadEnvConfig(process.cwd());

type Options = {
  saveId?: string;
  dryRun?: boolean;
};

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

function teamsWithoutSponsor(gameState: Parameters<typeof getTeamSponsorContract>[0]) {
  return gameState.teams
    .filter((team) => !getTeamSponsorContract(gameState, team.teamId))
    .map((team) => team.teamId);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const persistence = createPersistenceService();
  const save = options.saveId ? persistence.getSaveById(options.saveId) : persistence.getActiveSave();

  if (!save) {
    console.error(`Kein Save gefunden${options.saveId ? ` für --save-id ${options.saveId}` : ""}.`);
    process.exit(1);
  }

  const controlSettings = buildTeamControlSettingsMap(
    save.gameState.teams,
    save.gameState.seasonState.teamControlSettings,
  );

  const missingBefore = teamsWithoutSponsor(save.gameState);
  console.log(`Save: ${save.saveId} (${save.name})`);
  console.log(`Teams ohne Sponsor VORHER: ${missingBefore.length}/${save.gameState.teams.length}`);

  // 1) Angebote sicherstellen, 2) KI-Teams picken lassen (manual/passive bleiben offen).
  const withOffers = ensureSeasonSponsorOffers(save.gameState);
  const nextGameState = chooseSponsorOfferForAiTeams(withOffers, controlSettings);

  const missingAfter = teamsWithoutSponsor(nextGameState);
  const picked = missingBefore.filter((teamId) => !missingAfter.includes(teamId));
  const stillManual = missingAfter.filter((teamId) => {
    const mode = controlSettings[teamId]?.controlMode;
    return mode === "manual" || mode === "passive";
  });

  console.log(`KI-Teams neu mit Sponsor: ${picked.length} (${picked.join(", ") || "—"})`);
  console.log(
    `Noch offen (manuell/menschlich — bitte im Sponsoren-Tab selbst wählen): ${stillManual.join(", ") || "—"}`,
  );
  const stuck = missingAfter.filter((teamId) => !stillManual.includes(teamId));
  if (stuck.length > 0) {
    console.warn(`WARN: KI-Teams ohne Angebot/Sponsor (kein Pick möglich): ${stuck.join(", ")}`);
  }

  if (options.dryRun) {
    console.log("Dry run — nichts gespeichert.");
    return;
  }

  persistence.saveSingleplayerState(save.saveId, nextGameState, { status: save.status });
  console.log("Save gespeichert. Sponsor-Picks der KI-Teams sind jetzt aktiv.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
