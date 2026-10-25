/**
 * BIT-IDENTITÄT AM ECHTEN SPIELSTAND — für jeden Save im Abbild ein Fingerabdruck all dessen, was
 * die aktive Erholung / die 20-Spieltage-Umstellung berühren KÖNNTE. Zweimal gefahren (einmal gegen
 * `main`, einmal gegen den Branch), müssen die Fingerabdrücke jedes Saves, für den das Gate AUS ist,
 * übereinstimmen.
 *
 *   git show origin/live-save:data/online-saves/hetzner-live.sqlite.gz > abbild.gz
 *   gunzip -c abbild.gz > abbild.sqlite
 *   OLY_APP_SQLITE_PATH=abbild.sqlite npx tsx scripts/pruefe-erholung-gate-am-save-abbild.ts
 *
 * Geprüft wird je Save, am AKTUELLEN Spieltag:
 *   - spielplan    `getSeasonDisciplineSchedule` (Neuaufbau-Pfad ist jetzt repeat-bewusst)
 *   - kontexte     Aufstellungs-Kontexte aller Teams inkl. Verletzungsrisiko-Projektion der Einsatzliste
 *   - vorschau     `buildLegacyMatchdayResolvePreview` über alle Teams (die Resolve-Vorschau)
 *   - wurf         `buildMatchdayInjuryRollMap` (der Verletzungswurf)
 *   - buchung      `applyFatigueAndInjuryAfterMatchday` (Fatigue-Konto + Verletzungen danach)
 *   - ki-training  `buildTeamPlayerTrainingLoadPlans` aller Teams (die KI-Projektion)
 *   - statistik    `computeTeamSeasonAverageMatchdayFatigue` aller Teams
 *
 * Das Skript schreibt NICHTS zurück. Ausgabe: eine Zeile je Save plus ein Gesamt-Hash.
 */
import { createHash } from "node:crypto";

import type { GameState } from "@/lib/data/olyDataTypes";
import { buildTeamPlayerTrainingLoadPlans } from "@/lib/ai/ai-player-training-load-service";
import {
  applyFatigueAndInjuryAfterMatchday,
  buildMatchdayInjuryRollMap,
  isFatigueActiveRecoveryEnabled,
} from "@/lib/fatigue/fatigue-injury-service";
import { computeTeamSeasonAverageMatchdayFatigue } from "@/lib/foundation/team-history-health-metrics";
import { loadLocalLegacyLineupContextFromGameState } from "@/lib/lineups/legacy-lineup-local-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { buildLegacyMatchdayResolvePreview } from "@/lib/resolve/legacy-matchday-resolve-engine";
import { resolveGameMode } from "@/lib/season/game-mode";
import { getSeasonDisciplineSchedule } from "@/lib/season/season-discipline-schedule";

const FIXED_TIME = "2026-10-16T00:00:00.000Z";

const AUSGENOMMEN = /^(createdAt|updatedAt|generatedAt|timestamp|loadedAt|computedAt)$/;

/**
 * Strukturhash, inkrementell (die Kontexte aller 32 Teams sind zu groß für EIN `JSON.stringify`).
 * Schlüssel sortiert; Zeitstempel, die ohnehin bei jedem Aufruf neu entstehen, bleiben draußen.
 */
function feed(h: ReturnType<typeof createHash>, value: unknown): void {
  if (value instanceof Map) {
    h.update("M[");
    for (const [key, entry] of value.entries()) {
      feed(h, key);
      feed(h, entry);
    }
    h.update("]");
    return;
  }
  if (Array.isArray(value)) {
    h.update("[");
    for (const entry of value) feed(h, entry);
    h.update("]");
    return;
  }
  if (value && typeof value === "object") {
    h.update("{");
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      if (AUSGENOMMEN.test(key)) continue;
      h.update(JSON.stringify(key));
      feed(h, (value as Record<string, unknown>)[key]);
    }
    h.update("}");
    return;
  }
  h.update(`${typeof value}:${String(value)};`);
}

const hash = (value: unknown) => {
  const h = createHash("sha1");
  feed(h, value);
  return h.digest("hex").slice(0, 12);
};

function safe<T>(run: () => T): T | { fehler: string } {
  try {
    return run();
  } catch (error) {
    return { fehler: error instanceof Error ? error.message : String(error) };
  }
}

const persistence = createPersistenceService();
const zeilen: string[] = [];
for (const summary of persistence.listSaves()) {
  const save = persistence.getSaveById(summary.saveId);
  const gameState = save?.gameState as GameState | undefined;
  if (!gameState?.teams?.length || !gameState.season?.id) continue;
  const saveId = summary.saveId;
  const seasonId = gameState.season.id;
  const matchdayId = gameState.matchdayState?.matchdayId ?? gameState.season.matchdayIds?.[0] ?? "";
  const teamIds = gameState.teams.map((team) => team.teamId);

  const spielplan = safe(() => getSeasonDisciplineSchedule(gameState, { saveId }));
  const kontextErgebnisse = teamIds.map((teamId) =>
    safe(() => loadLocalLegacyLineupContextFromGameState(gameState, { saveId, seasonId, matchdayId, teamId })),
  );
  const kontexte = kontextErgebnisse.flatMap((result) =>
    result && "ok" in result && result.ok ? [result.context] : [],
  );
  const vorschau = safe(() => (kontexte.length > 0 ? buildLegacyMatchdayResolvePreview(kontexte) : null));
  const wurf = safe(() => buildMatchdayInjuryRollMap({ gameState, saveId, seasonId, matchdayId }));
  const buchung = safe(() => {
    const result = applyFatigueAndInjuryAfterMatchday({
      gameState,
      saveId,
      seasonId,
      matchdayId,
      matchdayResultId: `probe-${matchdayId}`,
      timestamp: FIXED_TIME,
    });
    return {
      availability: result.gameState.seasonState.playerAvailabilityState,
      fatigue: result.gameState.players.map((player) => [player.id, player.fatigue]),
      events: result.injuryEvents,
    };
  });
  const kiTraining = teamIds.map((teamId) =>
    safe(() => buildTeamPlayerTrainingLoadPlans({ gameState, teamId, teamBaselineIntensity: "normal" })),
  );
  const statistik = teamIds.map((teamId) =>
    safe(() => computeTeamSeasonAverageMatchdayFatigue({ gameState, teamId, seasonId })),
  );

  const teile = {
    spielplan: hash(spielplan),
    kontexte: hash(kontexte),
    vorschau: hash(vorschau),
    wurf: hash(wurf),
    buchung: hash(buchung),
    "ki-training": hash(kiTraining),
    statistik: hash(statistik),
  };
  const verletzt = Array.isArray((buchung as { events?: unknown[] }).events)
    ? (buchung as { events: Array<{ result: string }> }).events.filter((event) => event.result === "injured").length
    : "—";
  zeilen.push(
    [
      saveId.padEnd(44),
      resolveGameMode(gameState).padEnd(7),
      `${seasonId}/${matchdayId}`.padEnd(34),
      String(gameState.season.matchdayIds?.length ?? 0).padStart(2),
      String((isFatigueActiveRecoveryEnabled as (g?: GameState) => boolean)(gameState)).padEnd(5),
      String(kontexte.length).padStart(2),
      String(verletzt).padStart(3),
      Object.entries(teile)
        .map(([name, wert]) => `${name}=${wert}`)
        .join(" "),
    ].join(" "),
  );
}

console.log("saveId                                       modus   saison/spieltag                    MD aktiv  T  V  fingerabdrücke");
for (const zeile of zeilen) console.log(zeile);
console.log(`\nGESAMT ${createHash("sha1").update(zeilen.join("\n")).digest("hex").slice(0, 16)} (${zeilen.length} Saves)`);
