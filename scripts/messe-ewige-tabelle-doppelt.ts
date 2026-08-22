/* eslint-disable no-console */
/**
 * GEMELDET (`bia63a` / `6l1b0i`): „Ich bin gerade in S2 MD1 und in der Ewigen Tabelle haben alle
 * Teams doppelte Punkte - da wird was doppelt gespeichert" und „in der ewigen Tabelle sollen
 * wirklich nur vergangene abgeschlossene Seasons getrackt werden!"
 *
 * Dieses Skript zaehlt die Snapshots je Spielstand aus, BEVOR irgendetwas geaendert wird: wie
 * viele Snapshots liegen zu welcher seasonId, und stimmt ihre Zahl mit den abgeschlossenen
 * Saisons ueberein.
 *
 *   OLY_APP_SQLITE_PATH=/tmp/abbild-neu.sqlite npx tsx scripts/messe-ewige-tabelle-doppelt.ts
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
import type { GameState } from "@/lib/data/olyDataTypes";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { resolveSeasonSnapshotTeamRecords } from "@/lib/season/season-snapshot-helpers";

const p = createPersistenceService();
for (const eintrag of p.listSaves()) {
  const gs = p.getSaveById(eintrag.saveId)?.gameState as GameState | undefined;
  if (!gs?.teams?.length) continue;
  const roh = (gs.seasonState?.seasonSnapshots ?? []) as Array<{
    seasonId: string;
    seasonName?: string | null;
    createdAt?: string | null;
    entryRosterPatchedAt?: string | null;
  }>;
  const laufend = gs.season?.id;
  console.log(
    `\n${String(eintrag.saveId).slice(-6)}  laufende Saison ${laufend}  Spieltag ${gs.season?.currentMatchday}` +
      `  Snapshots gesamt: ${roh.length}`,
  );
  const jeSaison = new Map<string, number>();
  for (const s of roh) jeSaison.set(s.seasonId, (jeSaison.get(s.seasonId) ?? 0) + 1);
  for (const [seasonId, anzahl] of [...jeSaison].sort()) {
    const treffer = roh.filter((s) => s.seasonId === seasonId);
    const teams = treffer.map((s) => resolveSeasonSnapshotTeamRecords(s as never).length);
    const marke = anzahl > 1 ? "  <== MEHRFACH" : "";
    const istLaufend = seasonId === laufend ? "  <== LAUFENDE SAISON, gehoert nicht hinein" : "";
    console.log(
      `   ${seasonId}: ${anzahl} Snapshot(s), Teamzeilen ${teams.join("/")}` +
        `  createdAt ${treffer.map((s) => (s.createdAt ?? "?").slice(5, 19)).join(" | ")}${marke}${istLaufend}`,
    );
  }
}
