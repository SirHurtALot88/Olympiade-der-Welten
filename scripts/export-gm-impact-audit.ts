import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { createFreshSeasonOneGameState } from "@/lib/game-state/singleplayer-state";
import {
  GM_INFLUENCE_PCT,
  TEAM_GENERAL_MANAGER_PROFILES,
  getTeamGeneralManager,
} from "@/lib/foundation/team-general-managers";
import { getTeamStrategyProfile } from "@/lib/foundation/team-strategy-profiles";

const outputDir = join(process.cwd(), "reports");
const mdPath = join(outputDir, "gm-impact-audit.md");
const csvPath = join(outputDir, "gm-impact-audit.csv");

function axisSum(profile: { pow: number; spe: number; men: number; soc: number }) {
  return profile.pow + profile.spe + profile.men + profile.soc;
}

function axisShare(profile: { pow: number; spe: number; men: number; soc: number }) {
  const sum = axisSum(profile);
  if (!Number.isFinite(sum) || sum <= 0) {
    return { pow: 25, spe: 25, men: 25, soc: 25 };
  }
  return {
    pow: Math.round((profile.pow / sum) * 100),
    spe: Math.round((profile.spe / sum) * 100),
    men: Math.round((profile.men / sum) * 100),
    soc: Math.round((profile.soc / sum) * 100),
  };
}

function biasDistance(left: Record<string, number | undefined>, right: Record<string, number | undefined>) {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  return [...keys].reduce((sum, key) => sum + Math.abs((left[key] ?? 5) - (right[key] ?? 5)), 0);
}

function axisDistance(left: ReturnType<typeof axisShare>, right: ReturnType<typeof axisShare>) {
  return Math.abs(left.pow - right.pow) + Math.abs(left.spe - right.spe) + Math.abs(left.men - right.men) + Math.abs(left.soc - right.soc);
}

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  return text.includes(",") || text.includes("\"") || text.includes("\n") ? `"${text.replace(/"/g, "\"\"")}"` : text;
}

function main() {
  const gameState = createFreshSeasonOneGameState();
  const gmIds = new Set(TEAM_GENERAL_MANAGER_PROFILES.map((profile) => profile.gmId));
  const duplicateProfileCount = TEAM_GENERAL_MANAGER_PROFILES.length - gmIds.size;
  const assignments = gameState.seasonState.teamGeneralManagers ?? {};
  const assignedGmIds = Object.values(assignments).map((assignment) => assignment.gmId);
  const duplicateAssignmentCount = assignedGmIds.length - new Set(assignedGmIds).size;

  const profilesByArchetype = new Map<string, typeof TEAM_GENERAL_MANAGER_PROFILES>();
  for (const profile of TEAM_GENERAL_MANAGER_PROFILES) {
    profilesByArchetype.set(profile.archetype, [...(profilesByArchetype.get(profile.archetype) ?? []), profile]);
  }

  const variantRows = [...profilesByArchetype.entries()].map(([archetype, profiles]) => {
    const prime = profiles.find((profile) => profile.title.startsWith("Prime")) ?? profiles[0];
    const primeAxis = axisShare(prime);
    const axisDistances = profiles.map((profile) => axisDistance(axisShare(profile), primeAxis));
    const biasDistances = profiles.map((profile) => biasDistance(profile.bias, prime.bias));
    return {
      archetype,
      variants: profiles.length,
      maxAxisDistance: Math.max(...axisDistances),
      maxBiasDistance: Math.max(...biasDistances),
      changedVariants: profiles.filter((profile) => axisDistance(axisShare(profile), primeAxis) > 0 || biasDistance(profile.bias, prime.bias) > 0).length,
    };
  });

  const teamRows = gameState.teams.map((team) => {
    const gm = getTeamGeneralManager(gameState, team.teamId);
    const strategy = getTeamStrategyProfile(gameState, team.teamId);
    const gmAxis = gm ? axisShare(gm.profile) : null;
    return {
      teamId: team.teamId,
      team: team.name,
      gm: gm?.profile.name ?? "",
      gmTitle: gm?.profile.title ?? "",
      gmInfluencePct: gm?.assignment.influencePct ?? GM_INFLUENCE_PCT,
      gmPowShare: gmAxis?.pow ?? "",
      gmSpeShare: gmAxis?.spe ?? "",
      gmMenShare: gmAxis?.men ?? "",
      gmSocShare: gmAxis?.soc ?? "",
      strategyPow: strategy?.powBias ?? "",
      strategySpe: strategy?.speBias ?? "",
      strategyMen: strategy?.menBias ?? "",
      strategySoc: strategy?.socBias ?? "",
      cash: strategy?.bias.cashPriority ?? "",
      value: strategy?.bias.valuePriority ?? "",
      stars: strategy?.bias.starPriority ?? "",
      risk: strategy?.bias.riskTolerance ?? "",
      wage: strategy?.bias.wageSensitivity ?? "",
      sell: strategy?.bias.sellForProfitAggression ?? "",
      shortContract: strategy?.bias.shortContractPreference ?? "",
      longContract: strategy?.bias.longContractPreference ?? "",
      rosterDepth: strategy?.bias.rosterDepthPreference ?? "",
      elite: strategy?.bias.eliteSmallRosterPreference ?? "",
      strategyVersion: strategy?.strategyVersion ?? "",
    };
  });

  const warnings: string[] = [];
  if (TEAM_GENERAL_MANAGER_PROFILES.length !== 100) warnings.push(`expected_100_gms_got_${TEAM_GENERAL_MANAGER_PROFILES.length}`);
  if (duplicateProfileCount > 0) warnings.push(`duplicate_gm_profiles_${duplicateProfileCount}`);
  if (Object.keys(assignments).length !== 32) warnings.push(`expected_32_assignments_got_${Object.keys(assignments).length}`);
  if (duplicateAssignmentCount > 0) warnings.push(`duplicate_team_assignments_${duplicateAssignmentCount}`);
  for (const row of variantRows) {
    if (row.variants !== 10) warnings.push(`archetype_${row.archetype}_variant_count_${row.variants}`);
    if (row.maxBiasDistance <= 0) warnings.push(`archetype_${row.archetype}_no_bias_variation`);
    if (row.maxAxisDistance <= 0) warnings.push(`archetype_${row.archetype}_no_axis_variation`);
  }

  mkdirSync(outputDir, { recursive: true });

  const csvHeader = Object.keys(teamRows[0] ?? {});
  writeFileSync(
    csvPath,
    [csvHeader.join(","), ...teamRows.map((row) => csvHeader.map((key) => csvEscape(row[key as keyof typeof row])).join(","))].join("\n"),
  );

  const md = [
    "# GM Impact Audit",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "## Summary",
    "",
    `- GM profiles: ${TEAM_GENERAL_MANAGER_PROFILES.length}`,
    `- Unique GM ids: ${gmIds.size}`,
    `- Team assignments: ${Object.keys(assignments).length}`,
    `- Unique assigned GMs: ${new Set(assignedGmIds).size}`,
    `- GM influence: ${GM_INFLUENCE_PCT}%`,
    `- Status: ${warnings.length === 0 ? "GREEN" : "YELLOW"}`,
    "",
    warnings.length ? "## Warnings" : "## Warnings",
    "",
    ...(warnings.length ? warnings.map((warning) => `- ${warning}`) : ["- none"]),
    "",
    "## Archetype Variant Spread",
    "",
    "| Archetype | Variants | Changed Variants | Max Axis Delta | Max Bias Delta |",
    "|---|---:|---:|---:|---:|",
    ...variantRows.map(
      (row) => `| ${row.archetype} | ${row.variants} | ${row.changedVariants} | ${row.maxAxisDistance} | ${row.maxBiasDistance} |`,
    ),
    "",
    "## Team Assignment Sample",
    "",
    "| Team | GM | GM Axes | Strategy Axes | Key Biases |",
    "|---|---|---|---|---|",
    ...teamRows
      .slice(0, 32)
      .map(
        (row) =>
          `| ${row.team} | ${row.gmTitle} | ${row.gmPowShare}/${row.gmSpeShare}/${row.gmMenShare}/${row.gmSocShare} | ${row.strategyPow}/${row.strategySpe}/${row.strategyMen}/${row.strategySoc} | Cash ${row.cash}, Risk ${row.risk}, Stars ${row.stars}, Sell ${row.sell} |`,
      ),
    "",
    `CSV: ${csvPath}`,
    "",
  ].join("\n");

  writeFileSync(mdPath, md);
  console.log(`Wrote ${mdPath}`);
  console.log(`Wrote ${csvPath}`);
  if (warnings.length) {
    console.log(`Warnings: ${warnings.join(", ")}`);
  } else {
    console.log("GM impact audit GREEN");
  }
}

main();
