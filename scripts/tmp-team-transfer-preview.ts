import { buildAiTransfermarktSellPreview } from "@/lib/ai/ai-transfermarkt-sell-preview-service";
import { buildAiTransfermarktPreview } from "@/lib/ai/ai-transfermarkt-preview-service";

async function main() {
  process.env.OLY_APP_SQLITE_PATH =
    process.env.OLY_APP_SQLITE_PATH ?? "outputs/s1-s10-validated-run-1/balancing-run.sqlite";
  const teamId = process.argv[2] ?? "W-W";
  const saveId = "fresh-season-1-1783169019878";

  const sell = await buildAiTransfermarktSellPreview({
    source: "sqlite",
    saveId,
    teamId,
    limit: 15,
  });
  const sellTeam = sell.teams.find((entry) => entry.teamId === teamId);
  if (!sellTeam) throw new Error(`sell team ${teamId} missing`);

  console.log(`=== ${teamId} SELL-Preview (S10) ===`);
  console.log(
    `Kader: ${sellTeam.rosterSize} | Cash: ${sellTeam.cash?.toFixed(2)} | Gehalt: ${sellTeam.salaryTotal?.toFixed(2)} | ${sellTeam.budgetStatus}`,
  );
  console.log(`Verkaufs-Kandidaten: ${sellTeam.sellCandidates.length}\n`);

  for (const item of sellTeam.sellCandidates.slice(0, 10)) {
    console.log("---");
    console.log(`${item.playerName} | Prio ${item.sellPriority} | MW ${item.marketValue} | Verkauf ~${item.expectedSellValue}`);
    console.log(`Performance: ${item.performanceSummary ?? "—"}`);
    console.log(`Gründe PRO Verkauf: ${item.reasonToSell.join(" · ") || "—"}`);
    console.log(`Gründe GEGEN: ${item.reasonToKeep.join(" · ") || "—"}`);
  }

  const buy = await buildAiTransfermarktPreview({
    source: "sqlite",
    saveId,
    teamId,
    limit: 20,
    candidateScopeMode: "budget_wide",
    fullScoringLimit: 120,
  });
  const buyTeam = buy.teams.find((entry) => entry.teamId === teamId);
  if (!buyTeam) throw new Error(`buy team ${teamId} missing`);

  console.log(`\n=== ${teamId} BUY-Preview (S10) ===`);
  console.log(
    `Kader: ${buyTeam.rosterSize}/${buyTeam.targetRosterOpt} | Cash: ${buyTeam.cash?.toFixed(2)} | ${buyTeam.rosterStatus} · ${buyTeam.budgetStatus}`,
  );
  console.log(`Bedarf: ${buyTeam.needSummary}`);
  const list = buyTeam.recommendedBuys.length > 0 ? buyTeam.recommendedBuys : buyTeam.topTargets;
  console.log(`Top-Targets: ${buyTeam.topTargets.length} | Empfohlen: ${buyTeam.recommendedBuys.length} | Übersprungen: ${buyTeam.skippedTargets.length}\n`);

  for (const item of list.slice(0, 10)) {
    console.log("---");
    console.log(`${item.playerName ?? item.name} (OVR ${item.ovr}) | Score ${item.overallRecommendationScore}`);
    console.log(`MW ${item.marketValue} | Preis ${item.price} | Cash danach ${item.cashAfter?.toFixed(2)}`);
    if (item.buyDecisionLabel) console.log(`Label: ${item.buyDecisionLabel}`);
    if (item.reasonToBuy?.length) console.log(`Pro Kauf: ${item.reasonToBuy.join(" · ")}`);
    if (item.reasonToPass?.length) console.log(`Pro Pass: ${item.reasonToPass.join(" · ")}`);
    if (item.budgetReason?.length) console.log(`Budget: ${item.budgetReason.join(" · ")}`);
  }

  if (buyTeam.skippedTargets.length > 0) {
    console.log("\n--- Übersprungen ---");
    for (const skip of buyTeam.skippedTargets.slice(0, 10)) {
      console.log(`${skip.name}: ${skip.reason}${skip.blockingReasons.length ? ` · ${skip.blockingReasons.join(" · ")}` : ""}`);
    }
  }
}

main().catch(console.error);
