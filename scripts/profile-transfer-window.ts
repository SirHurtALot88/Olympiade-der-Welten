import path from "node:path";

import { loadEnvConfig } from "@next/env";

import { runTransferWindowSession } from "@/lib/ai/ai-transfer-window-session-service";
import {
  resetTransferWindowProfile,
  snapshotTransferWindowProfile,
} from "@/lib/ai/transfer-window-profiler";
import { bootstrapSaveToSeasonStart } from "@/lib/debug/bootstrap-save-to-season-start";
import { createPersistenceService } from "@/lib/persistence/persistence-service";

const PROJECT_ROOT = path.resolve(__dirname, "..");

function argValue(flag: string) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

function hasFlag(flag: string) {
  return process.argv.includes(flag);
}

async function main() {
  loadEnvConfig(PROJECT_ROOT);
  const persistence = createPersistenceService();

  if (hasFlag("--list")) {
    const saves = persistence.listSaves();
    console.log(`\n=== SAVES (${saves.length}) ===`);
    for (const summary of saves) {
      console.log(`${summary.saveId}  ·  ${summary.status ?? "?"}  ·  ${summary.name ?? ""}`);
    }
    return;
  }

  const cloneOnly = argValue("--clone-only");
  if (cloneOnly) {
    const clone = persistence.cloneSave(cloneOnly, `Multiseason S2-S5 resume ${Date.now()}`);
    console.log(`CLONED ${cloneOnly} -> ${clone.saveId}`);
    return;
  }

  const inspectId = argValue("--inspect");
  if (inspectId) {
    const full = persistence.getSaveById(inspectId);
    if (!full) throw new Error(`Save not found: ${inspectId}`);
    const gs = full.gameState;
    const rostersByTeam = new Map<string, number>();
    for (const entry of gs.rosters) rostersByTeam.set(entry.teamId, (rostersByTeam.get(entry.teamId) ?? 0) + 1);
    console.log(`\n=== SAVE ${inspectId} ===`);
    console.log(`season=${gs.season.id} currentMatchday=${gs.season.currentMatchday} matchdays=${gs.season.matchdayIds.length} phase=${gs.gamePhase ?? "?"}`);
    console.log(`teams=${gs.teams.length} rosters=${gs.rosters.length} players=${gs.players.length} transferHistory=${gs.transferHistory.length}`);
    console.log("roster counts: " + gs.teams.map((t) => `${t.shortCode}:${rostersByTeam.get(t.teamId) ?? 0}`).join(" "));
    return;
  }

  const cloneFrom = argValue("--clone-from");
  const saveIdArg = argValue("--save-id");
  const advanceTo = argValue("--advance-to");

  let saveId = saveIdArg;
  if (!saveId && cloneFrom) {
    const clone = persistence.cloneSave(cloneFrom, `Profile Transfer Window ${Date.now()}`);
    saveId = clone.saveId;
    console.error(`[profile] cloned ${cloneFrom} -> ${saveId}`);
  }
  if (!saveId) {
    throw new Error("Provide --save-id <id>, --clone-from <id>, or --list");
  }

  if (advanceTo) {
    console.error(`[profile] bootstrapping save to ${advanceTo} ...`);
    const bootstrap = await bootstrapSaveToSeasonStart({
      saveId,
      targetSeasonId: advanceTo,
      persistence,
      ensureAllTeamsAi: true,
      progressLog: true,
    });
    if (!bootstrap.ok) {
      throw new Error(`Bootstrap failed: ${bootstrap.blockers.join(" | ")}`);
    }
    console.error(
      `[profile] bootstrap done: ${bootstrap.fromSeasonId} -> ${bootstrap.toSeasonId} · ${bootstrap.matchdaysCompleted} MDs · ${bootstrap.seasonsAdvanced} season(s)`,
    );
  }

  const save = persistence.getSaveById(saveId);
  if (!save) throw new Error(`Save not found: ${saveId}`);
  const seasonId = save.gameState.season.id;

  console.error(`[profile] running transfer window session · save ${saveId} · season ${seasonId}`);
  resetTransferWindowProfile();
  const startedAt = Date.now();
  const result = await runTransferWindowSession({
    saveId,
    seasonId,
    persistence,
    phase: "preseason",
    teamScope: "all",
    maxTeamCycles: 5,
    maxLeagueRounds: 3,
    allowBuys: true,
    skipIfExistingMarketTransfers: false,
    progressLog: false,
  });
  const wallMs = Date.now() - startedAt;
  const profile = snapshotTransferWindowProfile();

  const buyAvg = profile.buyPreviewCalls > 0 ? profile.buyPreviewMs / profile.buyPreviewCalls : 0;
  const sellAvg = profile.sellPreviewCalls > 0 ? profile.sellPreviewMs / profile.sellPreviewCalls : 0;
  const feedTotal = profile.freeAgentFeedBuilds + profile.freeAgentFeedHits;
  const feedHitRate = feedTotal > 0 ? (profile.freeAgentFeedHits / feedTotal) * 100 : 0;

  const stageRows = Object.entries(profile.stageMs)
    .sort((a, b) => b[1] - a[1])
    .map(([key, value]) => `    ${key.padEnd(20)} ${value.toFixed(0)} ms`)
    .join("\n");

  console.log("\n=== TRANSFER WINDOW PROFILE ===");
  console.log(`season:            ${seasonId}`);
  console.log(`wall time:         ${wallMs} ms (${(wallMs / 1000).toFixed(1)} s)`);
  console.log(`league rounds:     ${result.leagueRounds}`);
  console.log(`team cycles:       ${result.teamCycles}`);
  console.log(`applied buys/sells:${result.appliedBuys} / ${result.appliedSells}`);
  console.log("--- buy preview (buildAiTransfermarktPreview) ---");
  console.log(`  calls:           ${profile.buyPreviewCalls}`);
  console.log(`  total ms:        ${profile.buyPreviewMs.toFixed(0)} ms`);
  console.log(`  avg ms/call:     ${buyAvg.toFixed(1)} ms`);
  console.log("--- sell preview (buildAiTransfermarktSellPreview) ---");
  console.log(`  calls:           ${profile.sellPreviewCalls}`);
  console.log(`  total ms:        ${profile.sellPreviewMs.toFixed(0)} ms`);
  console.log(`  avg ms/call:     ${sellAvg.toFixed(1)} ms`);
  console.log("--- free-agent feed (listLocalTransfermarktFreeAgents base cache) ---");
  console.log(`  builds (miss):   ${profile.freeAgentFeedBuilds}`);
  console.log(`  hits:            ${profile.freeAgentFeedHits}`);
  console.log(`  hit rate:        ${feedHitRate.toFixed(1)} %`);
  console.log(`  total build ms:  ${profile.freeAgentFeedBuildMs.toFixed(0)} ms`);
  console.log(`  items built:     ${profile.freeAgentFeedItemsBuilt}`);
  console.log("--- buy preview stage breakdown (summed across calls) ---");
  console.log(stageRows || "    (none)");
  console.log(`\nwarnings: ${result.warnings.slice(0, 8).join(" | ") || "(none)"}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
