/* eslint-disable no-console */
/**
 * WARUM HAENGT DER SPIELTAG? — die Aufstellungs-Bereitschaft je Team, an Zahlen statt an Vermutung.
 *
 * CHRIS: „wir haben doch wieder das D2 problem an MD10!!! … an MD8 schon gehabt und haengt jetzt
 * wieder. Was ist das denn fuer ein Blocker der immer wieder greift?"
 *
 * Gemeldet wird `resolve_status:incomplete_lineups` („Mindestens eine Einsatzliste ist noch
 * unvollstaendig"). Dieses Skript ruft die ECHTE Bereitschaftspruefung
 * (`buildLegacyMatchdayReadiness`) fuer jedes Team des laufenden Spieltags auf und stellt daneben
 * die Zahlen, aus denen sie ihr Urteil zieht: verfuegbare Spieler, Sollbesetzung, aufgestellte
 * Namen — und wie viele davon HEUTE noch spielen koennen.
 *
 * Aufruf:
 *   OLY_APP_SQLITE_PATH=<pfad> npx tsx scripts/diagnose-md-blocker.ts [--save <id>]
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import type { GameState } from "@/lib/data/olyDataTypes";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { loadLocalLegacyLineupContextFromGameState } from "@/lib/lineups/legacy-lineup-local-service";
import { buildLegacyMatchdayReadiness } from "@/lib/resolve/legacy-matchday-readiness";
import {
  countSelectedAvailablePlayers,
  isPartialLineupComplete,
} from "@/lib/lineups/legacy-matchday-partial-lineup-rule";

function argValue(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i >= 0 ? (process.argv[i + 1] ?? null) : null;
}

function main(): void {
  const persistence = createPersistenceService();
  const id = argValue("--save");
  const kopf = id ? persistence.getSaveById(id) : persistence.getActiveSave();
  if (!kopf?.gameState) throw new Error("Kein Spielstand gefunden.");
  const gs = kopf.gameState as GameState;
  const matchdayId = argValue("--matchday") ?? gs.matchdayState?.matchdayId ?? "";
  console.log(`${kopf.saveId} · ${gs.season.id} · ${matchdayId} · Status ${gs.matchdayState?.status}\n`);

  const zeilen: string[] = [];
  let blockiert = 0;
  for (const team of gs.teams) {
    const geladen = loadLocalLegacyLineupContextFromGameState(gs, {
      saveId: kopf.saveId,
      seasonId: gs.season.id,
      matchdayId,
      teamId: team.teamId,
    });
    const context = (geladen as { context?: unknown }).context;
    if (!context) {
      zeilen.push(`${(team.shortCode ?? team.teamId).padEnd(6)} KONTEXT FEHLT: ${JSON.stringify(geladen).slice(0, 120)}`);
      continue;
    }
    const ctx = context as Parameters<typeof buildLegacyMatchdayReadiness>[0];
    const readiness = buildLegacyMatchdayReadiness(ctx);
    const entwurf = ctx.existingDraft;
    const aufgestellt = entwurf ? new Set(entwurf.entries.map((e) => e.playerId)).size : 0;
    const nochVerfuegbar = entwurf
      ? countSelectedAvailablePlayers(
          entwurf.entries.map((e) => e.playerId),
          ctx.activePlayers.map((e) => e.playerId),
        )
      : 0;
    const teilweiseOk = isPartialLineupComplete({
      activePlayersCount: ctx.activePlayers.length,
      requiredTotalUniquePlayers: readiness.requiredTotalUniquePlayers,
      selectedAvailablePlayerCount: nochVerfuegbar,
    });
    const ok = readiness.readinessStatus === "ready";
    if (!ok) blockiert += 1;
    zeilen.push(
      `${(team.shortCode ?? team.teamId).padEnd(6)} ${ok ? "OK    " : "BLOCK "} ` +
        `verfuegbar ${String(ctx.activePlayers.length).padStart(2)} · soll ${String(readiness.requiredTotalUniquePlayers).padStart(2)} · ` +
        `aufgestellt ${String(aufgestellt).padStart(2)} · davon spielfaehig ${String(nochVerfuegbar).padStart(2)} · ` +
        `Teil-Regel greift: ${teilweiseOk ? "ja " : "nein"} · ${readiness.readinessStatus}` +
        (readiness.reasonCodes?.length ? ` [${readiness.reasonCodes.join(",")}]` : ""),
    );
  }
  console.log(zeilen.join("\n"));
  console.log(`\n  ${blockiert} von ${gs.teams.length} Teams blockieren den Spieltag.`);
}

main();
