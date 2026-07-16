import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { buildAiTransfermarktPreview } from "@/lib/ai/ai-transfermarkt-preview-service";

async function main() {
  process.env.OLY_APP_SQLITE_PATH =
    process.env.OLY_APP_SQLITE_PATH ?? "outputs/s1-s10-validated-run-1/balancing-run.sqlite";
  const teamId = process.argv[2] ?? "A-A";
  const save = createPersistenceService().getSaveById("fresh-season-1-1783169019878");
  if (!save) throw new Error("save missing");

  const preview = await buildAiTransfermarktPreview({
    source: "sqlite",
    saveId: save.saveId,
    teamId,
    limit: 15,
  });
  const team = preview.teams.find((entry) => entry.teamId === teamId);
  if (!team) throw new Error(`team ${teamId} missing`);

  console.log(`=== ${teamId} Buy-Preview (S10 Endstand) ===`);
  console.log(
    `Kader: ${team.rosterSize}/${team.targetRosterOpt ?? "?"} | Cash: ${team.cash?.toFixed(2)} | Status: ${team.rosterStatus} · ${team.budgetStatus}`,
  );
  console.log(`Bedarf: ${team.needSummary}`);
  console.log(`Top-Targets: ${team.topTargets.length} | Empfohlene Käufe: ${team.recommendedBuys.length} | Übersprungen: ${team.skippedTargets.length}`);
  console.log("");

  const list = team.recommendedBuys.length > 0 ? team.recommendedBuys : team.topTargets;
  for (const item of list.slice(0, 12)) {
    console.log("---");
    console.log(`Spieler: ${item.playerName ?? item.name} (OVR ${item.ovr ?? "?"})`);
    console.log(`Score: ${item.overallRecommendationScore ?? item.score} | MW: ${item.marketValue} | Preis: ${item.price ?? item.marketValue}`);
    console.log(`Cash danach: ${item.cashAfter?.toFixed(2) ?? "?"} | Kader danach: ${item.rosterAfter ?? "?"}`);
    if (item.buyDecisionLabel) console.log(`Entscheidung: ${item.buyDecisionLabel}`);
    if (item.reasonToBuy?.length) console.log(`Pro Kauf: ${item.reasonToBuy.join(" · ")}`);
    if (item.reasonToPass?.length) console.log(`Pro Pass: ${item.reasonToPass.join(" · ")}`);
    if (item.budgetReason?.length) console.log(`Budget: ${item.budgetReason.join(" · ")}`);
    if (item.warnings?.length) console.log(`Warnungen: ${item.warnings.join(" · ")}`);
    if (item.riskNotes?.length) console.log(`Risiko: ${item.riskNotes.join(" · ")}`);
  }

  if (team.skippedTargets.length > 0) {
    console.log("\n=== Übersprungene Kandidaten (Auszug) ===");
    for (const skip of team.skippedTargets.slice(0, 8)) {
      console.log(`- ${skip.name}: ${skip.reason}${skip.blockingReasons.length ? ` · ${skip.blockingReasons.join(" · ")}` : ""}`);
    }
  }
}

main().catch(console.error);
