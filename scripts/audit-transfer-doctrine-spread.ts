import { resolveTransferDoctrineFromProfile, summarizeDoctrineSpread } from "@/lib/ai/ai-transfer-doctrine-layer";
import { loadSourceTeams, loadSourceTeamIdentities } from "@/lib/data/dataAdapter";
import { buildTeamStrategyProfileMap } from "@/lib/foundation/team-strategy-profiles";

function main() {
  const teams = loadSourceTeams();
  const identities = loadSourceTeamIdentities();
  const identityByTeamId = new Map(identities.map((identity) => [identity.teamId, identity] as const));
  const profiles = buildTeamStrategyProfileMap(teams, identities);
  const doctrines = teams
    .map((team) => {
      const profile = profiles[team.teamId];
      const identity = identityByTeamId.get(team.teamId) ?? null;
      if (!profile) return null;
      return {
        teamId: team.teamId,
        summary: profile.strategySummary,
        doctrine: resolveTransferDoctrineFromProfile(profile, identity),
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  const spread = summarizeDoctrineSpread(doctrines.map((entry) => entry.doctrine));
  console.log("Transfer doctrine spread:");
  for (const [persona, count] of Object.entries(spread).sort((left, right) => right[1] - left[1])) {
    console.log(`  ${persona}: ${count}`);
  }

  console.log("\nPer-team doctrine:");
  for (const entry of doctrines.sort((left, right) => left.teamId.localeCompare(right.teamId))) {
    const d = entry.doctrine;
    console.log(
      `${entry.teamId} | ${d.persona.padEnd(13)} | buy ${d.buyIntentScale.toFixed(2)} pass ${d.passIntentScale.toFixed(2)} sell ${d.sellIntentScale.toFixed(2)} keep ${d.keepIntentScale.toFixed(2)} cashBuf ${d.cashBufferScale.toFixed(2)}`,
    );
  }

  const balancedCount = spread.balanced ?? 0;
  const balancedPct = Math.round((balancedCount / doctrines.length) * 100);
  if (balancedPct > 40) {
    console.log(`\nWARN balanced persona still ${balancedPct}% (${balancedCount}/${doctrines.length})`);
    process.exitCode = 1;
  }
}

main();
