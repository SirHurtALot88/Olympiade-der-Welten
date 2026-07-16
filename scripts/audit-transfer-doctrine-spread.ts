import { resolveTransferDoctrineFromProfile, formatPersonaBlend, summarizeDoctrineSpread } from "@/lib/ai/ai-transfer-doctrine-layer";
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
  console.log("Dominant persona spread:");
  for (const [persona, count] of Object.entries(spread).sort((left, right) => right[1] - left[1])) {
    console.log(`  ${persona}: ${count}`);
  }

  console.log("\nPer-team axes + blend:");
  for (const entry of doctrines.sort((left, right) => left.teamId.localeCompare(right.teamId))) {
    const d = entry.doctrine;
    console.log(
      `${entry.teamId} | dom ${d.persona.padEnd(11)} | trade ${d.axes.tradeRotation.toFixed(2)} talent ${d.axes.talentFocus.toFixed(2)} | ${formatPersonaBlend(d.personaBlend)}`,
    );
  }

  const tt = doctrines.find((entry) => entry.teamId === "T-T");
  if (tt) {
    console.log("\nT-T spotlight:");
    console.log(`  hint: ${tt.doctrine.personaHint}`);
    console.log(`  blend: ${formatPersonaBlend(tt.doctrine.personaBlend)}`);
  }

  const maxBalanced = Math.max(...doctrines.map((entry) => entry.doctrine.personaBlend.balanced ?? 0));
  console.log(`\nMax balanced blend weight: ${Math.round(maxBalanced * 100)}%`);
}

main();
