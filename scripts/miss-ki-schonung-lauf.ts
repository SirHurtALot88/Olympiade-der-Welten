/* eslint-disable no-console */
/**
 * KI-SCHONUNG VORHER/NACHHER — spielt ab dem aktuellen Spieltag einer KOPIE des Live-Abbilds mehrere Spieltage
 * komplett durch (KI-Aufstellung, Wertung, Buchung, Spieltagsabschluss) und schreibt die Kennzahlen nach stdout.
 * Alle Teams werden dafuer auf KI gestellt (nur die Messkopie!). Wertung ueber den Node-Motor.
 *
 *   OLY_APP_SQLITE_PATH=/pfad/kopie.sqlite OLY_AUTO_EXPORT_SAVES=0 OLY_AUTO_EXPORT_PUSH=0 \
 *     OLY_MESS_SAVE=<saveId> OLY_MESS_SPIELTAGE=8 npx tsx scripts/miss-ki-schonung-lauf.ts
 *
 * Kennzahlen (nur die in diesem Lauf gespielten Spieltage): Anteil conserve/normal/push je Seite, Einsaetze mit
 * Fatigue >= 40 / >= 65 am Wurf, Verletzungen, erwartete Verletzungen (Summe Risiko), Reha-Bauten und Kosten,
 * Kadergroesse, mittlere Aufstellungsstaerke (Summe Eignung der Aufgestellten je Seite).
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import { applyAiLegacyLineupBatchLocally } from "@/lib/ai/ai-legacy-lineup-batch-apply-service";
import { beschleunigeArenaVorlaufPerQuickSim, kickoffArenaVorlauf } from "@/lib/battle/arena-vorlauf-service";
import { applyGameModeOwnership } from "@/lib/foundation/team-control-settings";
import { ensureMatchdayResolveSnapshot } from "@/lib/foundation/matchday-resolve-snapshot";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { MATCHDAY_AUTO_RUN_CONFIRM_TOKEN, runLocalMatchdayAutoRun } from "@/lib/season/matchday-auto-run-service";

const SAVE_ID = process.env.OLY_MESS_SAVE ?? "new-game-1795114260527-nzr0z9";
const SPIELTAGE = Number(process.env.OLY_MESS_SPIELTAGE ?? 8);

async function main() {
  const persistence = createPersistenceService();
  const roh = persistence.getSaveById(SAVE_ID);
  if (!roh) throw new Error(`Spielstand ${SAVE_ID} nicht gefunden`);
  persistence.saveSingleplayerState(
    SAVE_ID,
    applyGameModeOwnership(roh.gameState, { saveMode: "solo_1", chrisTeamIds: [], frankyTeamIds: [] }),
  );
  const start = persistence.getSaveById(SAVE_ID)!.gameState;
  const seasonId = start.season.id;
  const startMatchdayId = start.matchdayState.matchdayId;
  const eventsVorher = new Set((start.seasonState.injuryEvents ?? []).map((event) => event.eventId));
  const facilityVorher = new Set((start.seasonState.facilityEvents ?? []).map((event) => event.eventId));
  const gespielt: string[] = [];

  for (let i = 0; i < SPIELTAGE; i += 1) {
    const gs = persistence.getSaveById(SAVE_ID)!.gameState;
    if (gs.season.id !== seasonId) break;
    const matchdayId = gs.matchdayState.matchdayId;
    const scope = { saveId: SAVE_ID, seasonId, matchdayId };
    applyAiLegacyLineupBatchLocally(
      { saveId: SAVE_ID, seasonId, matchdayId, dryRun: false, includeWarningTeams: true, overwriteExisting: true },
      persistence,
    );
    ensureMatchdayResolveSnapshot(scope, persistence);
    kickoffArenaVorlauf(scope, {}, persistence);
    await beschleunigeArenaVorlaufPerQuickSim(scope, {}, persistence);
    const lauf = await runLocalMatchdayAutoRun(
      {
        saveId: SAVE_ID,
        seasonId,
        matchdayId,
        source: "sqlite",
        execute: true,
        dryRun: false,
        confirmToken: MATCHDAY_AUTO_RUN_CONFIRM_TOKEN,
        options: { includeWarningLineups: true, overwriteExistingLineups: false, stopOnTie: false, advanceAfterCashApply: true },
      },
      persistence,
    );
    gespielt.push(matchdayId);
    console.error(`[lauf] ${matchdayId} ok=${lauf.ok} ${lauf.ok ? "" : (lauf.blockingReasons ?? []).slice(0, 3).join(" | ")}`);
    if (!lauf.ok) break;
  }

  const ende = persistence.getSaveById(SAVE_ID)!.gameState;
  const neu = (ende.seasonState.injuryEvents ?? []).filter((event) => !eventsVorher.has(event.eventId) && event.seasonId === seasonId);
  const verletzt = neu.filter((event) => event.result === "injured").length;
  const erwartet = neu.reduce((summe, event) => summe + (event.riskPercent ?? 0) / 100, 0);
  const ab40 = neu.filter((event) => event.fatigueBefore >= 40).length;
  const ab65 = neu.filter((event) => event.fatigueBefore >= 65).length;

  const spieltagIds = new Set(gespielt);
  let seiten = 0;
  const stufen: Record<string, number> = { conserve: 0, normal: 0, push: 0 };
  let einsaetze = 0;
  const einsatzStufen: Record<string, number> = { conserve: 0, normal: 0, push: 0 };
  for (const draft of ende.seasonState.lineupDrafts ?? []) {
    const d = draft as unknown as {
      matchdayId?: string;
      modifiers?: Record<string, { intensity?: string }>;
      entries?: Array<{ disciplineSide: string }>;
    };
    if (!d.matchdayId || !spieltagIds.has(d.matchdayId)) continue;
    for (const side of ["d1", "d2"] as const) {
      const anzahl = (d.entries ?? []).filter((entry) => entry.disciplineSide === side).length;
      if (anzahl === 0) continue;
      const stufe = d.modifiers?.[side]?.intensity ?? "normal";
      seiten += 1;
      stufen[stufe] = (stufen[stufe] ?? 0) + 1;
      einsaetze += anzahl;
      einsatzStufen[stufe] = (einsatzStufen[stufe] ?? 0) + anzahl;
    }
  }

  const bauten = (ende.seasonState.facilityEvents ?? []).filter((event) => !facilityVorher.has(event.eventId));
  const reha = bauten.filter((event) => event.facilityId === "recovery_center");
  const kader = ende.teams.map((team) => ende.rosters.filter((entry) => entry.teamId === team.teamId).length);
  const rehaStufen: Record<number, number> = {};
  for (const team of ende.teams) {
    const stufe = ende.seasonState.teamFacilities?.[team.teamId]?.facilities?.recovery_center?.level ?? 0;
    rehaStufen[stufe] = (rehaStufen[stufe] ?? 0) + 1;
  }
  const pct = (a: number, b: number) => (b > 0 ? `${((100 * a) / b).toFixed(1)} %` : "-");
  const ergebnis = {
    start: startMatchdayId,
    gespielteSpieltage: gespielt.length,
    seiten,
    seitenAnteil: { conserve: pct(stufen.conserve!, seiten), normal: pct(stufen.normal!, seiten), push: pct(stufen.push!, seiten) },
    einsaetze,
    einsatzAnteil: {
      conserve: pct(einsatzStufen.conserve!, einsaetze),
      normal: pct(einsatzStufen.normal!, einsaetze),
      push: pct(einsatzStufen.push!, einsaetze),
    },
    wuerfe: neu.length,
    fatigueAb40: pct(ab40, neu.length),
    fatigueAb65: pct(ab65, neu.length),
    verletzungen: verletzt,
    erwarteteVerletzungen: Number(erwartet.toFixed(1)),
    verletzungenJe20Spieltage: gespielt.length > 0 ? Number(((verletzt * 20) / gespielt.length).toFixed(0)) : null,
    erwartetJe20Spieltage: gespielt.length > 0 ? Number(((erwartet * 20) / gespielt.length).toFixed(0)) : null,
    rehaBauten: reha.length,
    rehaKosten: Number(reha.reduce((summe, event) => summe + (event.cost ?? 0), 0).toFixed(1)),
    rehaStufenVerteilung: rehaStufen,
    kaderMitDuenn: kader.filter((n) => n <= 10).length,
    kaderMittel: Number((kader.reduce((a, b) => a + b, 0) / Math.max(1, kader.length)).toFixed(2)),
  };
  console.log(JSON.stringify(ergebnis, null, 2));
}

void main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
