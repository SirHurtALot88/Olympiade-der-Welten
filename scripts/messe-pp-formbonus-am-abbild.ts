/* eslint-disable no-console */
/**
 * MESSUNG: PP-Formbonus (Saisonstand) und Formkarten-Inbox — voller Save gegen kompakten Payload.
 * Nutzung: OLY_APP_SQLITE_PATH=/tmp/abbild.sqlite npx tsx <dieses Skript> [--save <id>]
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import type { GameState } from "@/lib/data/olyDataTypes";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { compactFoundationInitialGameState } from "@/lib/persistence/foundation-initial-compact-state";
import { buildPpAreaFormBonusByTeamId } from "@/lib/foundation/pp-area-form-bonus";
import { buildFormCardSeasonUsageAudit } from "@/lib/lineups/legacy-lineup-modifiers";
import { buildGameInboxItems } from "@/lib/foundation/game-inbox-service";

function args() {
  const argv = process.argv.slice(2);
  const i = argv.indexOf("--save");
  return { saveId: i >= 0 ? argv[i + 1] : null };
}

function durchsJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

async function main() {
  const { saveId } = args();
  const persistence = createPersistenceService();
  const save = saveId ? persistence.getSaveById(saveId) : persistence.getActiveSave();
  if (!save) {
    console.error("Kein Spielstand.");
    process.exit(2);
    return;
  }
  const voll: GameState = save.gameState;
  const kompakt: GameState = durchsJson(compactFoundationInitialGameState(voll));

  console.log(`Spielstand : ${save.saveId} — ${save.name}`);
  console.log(`Saison     : ${voll.season.id} (${voll.season.seasonNumber ?? "?"}) Spieltag ${voll.matchdayState.matchdayId}`);
  const seasonId = voll.season.id;

  console.log(
    `lineupDrafts     voll ${voll.seasonState.lineupDrafts?.length ?? 0}  kompakt ${kompakt.seasonState.lineupDrafts?.length ?? 0}`,
  );
  console.log(
    `disciplineResults voll ${voll.seasonState.disciplineResults?.length ?? 0}  kompakt ${kompakt.seasonState.disciplineResults?.length ?? 0}`,
  );
  console.log(
    `matchdayResults  voll ${voll.seasonState.matchdayResults?.length ?? 0}  kompakt ${kompakt.seasonState.matchdayResults?.length ?? 0}`,
  );
  console.log(
    `seasonSnapshots  voll ${voll.seasonState.seasonSnapshots?.length ?? 0}  kompakt ${kompakt.seasonState.seasonSnapshots?.length ?? 0}`,
  );

  const vollBonus = buildPpAreaFormBonusByTeamId(voll, seasonId);
  const kompaktBonus = buildPpAreaFormBonusByTeamId(kompakt, seasonId);

  const teamName = new Map(voll.teams.map((t) => [t.teamId, t.name ?? t.shortCode ?? t.teamId] as const));
  console.log(`\n=== PP-Formbonus (total) — Teams mit Bilanz: voll ${Object.keys(vollBonus).length}, kompakt ${Object.keys(kompaktBonus).length}`);
  const alle = new Set([...Object.keys(vollBonus), ...Object.keys(kompaktBonus)]);
  const zeilen = [...alle]
    .map((teamId) => ({
      teamId,
      name: teamName.get(teamId) ?? teamId,
      voll: vollBonus[teamId]?.total ?? null,
      kompakt: kompaktBonus[teamId]?.total ?? null,
    }))
    .sort((a, b) => (b.voll ?? -Infinity) - (a.voll ?? -Infinity));
  for (const z of zeilen) {
    const flag = z.voll === z.kompakt ? "  " : z.kompakt == null ? "!!" : "->";
    console.log(`${flag} ${z.name.padEnd(26)} voll ${String(z.voll).padStart(8)}  kompakt ${String(z.kompakt).padStart(8)}`);
  }

  // Formkarten-Nutzung
  const vollAudit = buildFormCardSeasonUsageAudit(voll, seasonId);
  const kompaktAudit = buildFormCardSeasonUsageAudit(kompakt, seasonId);
  console.log(
    `\n=== Formkarten-Nutzung  voll: used ${vollAudit.usedCards}/${vollAudit.totalCards}, unusedNeg ${vollAudit.unusedNegativeCards}, Strafe ${vollAudit.negativePenaltyPoints}`,
  );
  console.log(
    `                     kompakt: used ${kompaktAudit.usedCards}/${kompaktAudit.totalCards}, unusedNeg ${kompaktAudit.unusedNegativeCards}, Strafe ${kompaktAudit.negativePenaltyPoints}`,
  );
  const manuell = Object.values(voll.seasonState.teamControlSettings ?? {})
    .filter((s: { controlMode?: string; teamId?: string }) => s?.controlMode === "manual")
    .map((s: { teamId?: string }) => s.teamId);
  console.log(`manuelle Teams: ${manuell.join(", ")}`);
  for (const teamId of manuell) {
    const v = vollAudit.rows.find((r) => r.teamId === teamId);
    const k = kompaktAudit.rows.find((r) => r.teamId === teamId);
    console.log(
      `  ${teamId}: voll unusedNeg ${v?.unusedNegativeCards} (Strafe ${v?.negativePenaltyPoints}) | kompakt unusedNeg ${k?.unusedNegativeCards} (Strafe ${k?.negativePenaltyPoints})`,
    );
  }

  // --- Inbox-Vergleich ---
  const inbox = (state: GameState) =>
    buildGameInboxItems({ gameState: state, saveId: save.saveId, activeTeamId: "S-C", now: "2026-08-11T00:00:00.000Z" });
  const vollInbox = inbox(voll);
  const kompaktInbox = inbox(kompakt);
  console.log(`\n=== Inbox: voll ${vollInbox.length} Eintraege, kompakt ${kompaktInbox.length}`);
  const vollIds = new Map(vollInbox.map((i) => [i.itemId, i] as const));
  const kompaktIds = new Map(kompaktInbox.map((i) => [i.itemId, i] as const));
  for (const [id, item] of vollIds) {
    if (!kompaktIds.has(id)) console.log(`  FEHLT im Browser : [${item.severity}/${item.source}] ${item.title} — ${item.description}`);
  }
  for (const [id, item] of kompaktIds) {
    if (!vollIds.has(id)) console.log(`  NUR im Browser   : [${item.severity}/${item.source}] ${item.title} — ${item.description}`);
  }

  const groesse = (v: unknown) => `${(Buffer.byteLength(JSON.stringify(v ?? null), "utf8") / 1024).toFixed(1)} KB`;
  console.log(`\nGroesse Projektion PP-Formbonus: ${groesse(vollBonus)}`);
  console.log(`Groesse kompakter Payload gesamt: ${groesse(kompakt)}`);
}

void main();
