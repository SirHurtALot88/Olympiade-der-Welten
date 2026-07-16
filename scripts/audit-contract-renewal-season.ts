import fs from "node:fs";
import path from "node:path";

import { loadEnvConfig } from "@next/env";

import { previewSeasonEndContracts } from "@/lib/contracts/contract-renewal-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";

const PROJECT_ROOT = path.resolve(__dirname, "..");

function argValue(flag: string) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

async function main() {
  loadEnvConfig(PROJECT_ROOT);
  const saveId = argValue("--save-id");
  const seasonFilter = argValue("--season");
  if (!saveId) throw new Error("Provide --save-id");

  const persistence = createPersistenceService();
  const save = persistence.getSaveById(saveId);
  if (!save) throw new Error(`Save not found: ${saveId}`);

  const preview = previewSeasonEndContracts(save);
  const appliedEvents = (save.gameState.seasonState.contractEvents ?? []).filter(
    (event) => !seasonFilter || event.seasonId === seasonFilter,
  );

  const renewed = appliedEvents.filter((event) => event.eventType === "contract_renewed");
  const released = appliedEvents.filter((event) => event.eventType === "contract_expired_exit");

  const expiringRows = preview.rows.filter((row) => row.statusBeforeTick === "expiring");
  const outOfContractRows = preview.rows.filter((row) => row.statusAfterTick === "out_of_contract");
  const aiRows = outOfContractRows.filter((row) => row.controlMode === "ai");

  const byBlockReason = Object.fromEntries(
    aiRows.reduce((map, row) => {
      const key = row.renewalBlockReason ?? "unknown";
      map.set(key, (map.get(key) ?? 0) + 1);
      return map;
    }, new Map<string, number>()),
  );

  const coreReleased = aiRows.filter(
    (row) =>
      row.recommendedAction === "release" &&
      row.ovr != null &&
      row.ovr >= 55 &&
      (row.renewalBlockReason === "cash_gate" || row.renewalBlockReason === "heuristic"),
  );

  const report = {
    saveId,
    activeSeasonId: save.gameState.season.id,
    gamePhase: save.gameState.gamePhase,
    preview: {
      expiringBeforeTick: expiringRows.length,
      outOfContractAfterTick: outOfContractRows.length,
      aiRenewCandidates: preview.aiRenewalCandidates,
      aiReleaseCandidates: preview.aiReleaseCandidates,
      manualDecisions: preview.manualDecisionCount,
      aiBlockReasons: byBlockReason,
      coreWrongfullyReleased: coreReleased.map((row) => ({
        teamId: row.teamId,
        shortCode: row.teamName,
        playerId: row.playerId,
        playerName: row.playerName,
        ovr: row.ovr,
        renewalBlockReason: row.renewalBlockReason,
      })),
    },
    appliedHistory: seasonFilter
      ? {
          seasonId: seasonFilter,
          renewed: renewed.length,
          released: released.length,
          renewRate:
            renewed.length + released.length > 0
              ? Number(((renewed.length / (renewed.length + released.length)) * 100).toFixed(1))
              : null,
        }
      : {
          renewed: renewed.length,
          released: released.length,
        },
  };

  const outputDir = path.join(PROJECT_ROOT, "outputs", "contract-audit", `${Date.now()}`);
  fs.mkdirSync(outputDir, { recursive: true });
  const reportPath = path.join(outputDir, "contract-renewal-audit.json");
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  console.log("\n=== CONTRACT RENEWAL AUDIT ===");
  console.log(`saveId: ${saveId} · season filter: ${seasonFilter ?? "all"}`);
  console.log(`expiring (LZ=1): ${expiringRows.length} · out of contract after tick: ${outOfContractRows.length}`);
  console.log(`AI renew candidates: ${preview.aiRenewalCandidates} · release candidates: ${preview.aiReleaseCandidates}`);
  console.log(`block reasons: ${JSON.stringify(byBlockReason)}`);
  if (seasonFilter) {
    console.log(`applied ${seasonFilter}: renewed ${renewed.length} · released ${released.length}`);
  }
  console.log(`report: ${reportPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
