import { loadEnvConfig } from "@next/env";
import path from "node:path";

import { db } from "@/src/server/db";
import { projectFoundationStateFromPrisma } from "@/lib/db/read/foundation-read-projection";
import { loadFoundationSnapshotFromPrisma } from "@/lib/db/read/foundation-read-repository";

type DisciplineWeightAudit = {
  disciplineId: string;
  disciplineName: string;
  weightCount: number;
  weightSum: number;
};

function formatAuditRow(row: DisciplineWeightAudit) {
  return `${row.disciplineId.padEnd(16)} ${String(row.weightCount).padStart(2)} weights  sum=${row.weightSum}`;
}

async function main() {
  loadEnvConfig(path.resolve(__dirname, ".."));

  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is missing. db:check-foundation-projection requires .env.local in the project root.",
    );
  }

  const snapshot = await loadFoundationSnapshotFromPrisma();

  if (!snapshot) {
    throw new Error(
      "Prisma foundation snapshot could not be loaded even though DATABASE_URL is configured. Check whether the active Prisma save/season records are present and readable.",
    );
  }

  const projection = projectFoundationStateFromPrisma(snapshot);
  const transferCount = await db.transfer.count({
    where: {
      saveId: snapshot.save.id,
      seasonId: snapshot.season.id,
    },
  });

  const disciplineWeightAudit = snapshot.disciplines.map<DisciplineWeightAudit>((discipline) => {
    const activeWeights = discipline.weights.filter((weight) => Number(weight.weightPct) > 0);
    const weightSum = activeWeights.reduce((total, weight) => total + Number(weight.weightPct), 0);

    return {
      disciplineId: discipline.id,
      disciplineName: discipline.name,
      weightCount: activeWeights.length,
      weightSum,
    };
  });

  const counts = {
    teams: projection.save.gameState.teams.length,
    players: projection.save.gameState.players.length,
    disciplines: projection.save.gameState.disciplines.length,
    disciplineWeights: disciplineWeightAudit.reduce((total, row) => total + row.weightCount, 0),
    teamSeasonStates: snapshot.teamSeasonStates.length,
    activePlayers: snapshot.activePlayers.length,
    matchdays: snapshot.matchdays.length,
    transfers: transferCount,
  };

  console.log("Foundation projection check");
  console.log(`- Save: ${snapshot.save.name} (${snapshot.save.id})`);
  console.log(`- Teams: ${counts.teams}`);
  console.log(`- Players: ${counts.players}`);
  console.log(`- Disciplines: ${counts.disciplines}`);
  console.log(`- DisciplineWeights: ${counts.disciplineWeights}`);
  console.log(`- TeamSeasonStates: ${counts.teamSeasonStates}`);
  console.log(`- ActivePlayers: ${counts.activePlayers}`);
  console.log(`- Matchdays: ${counts.matchdays}`);
  console.log(`- Transfers: ${counts.transfers}`);
  console.log("- Weight sums by discipline:");
  for (const row of disciplineWeightAudit) {
    console.log(`  ${formatAuditRow(row)}  (${row.disciplineName})`);
  }

  const errors: string[] = [];
  const warnings: string[] = [];

  if (counts.teams !== 32) {
    errors.push(`Expected Teams = 32, got ${counts.teams}`);
  }

  if (counts.disciplines !== 20) {
    errors.push(`Expected Disciplines = 20, got ${counts.disciplines}`);
  }

  if (counts.transfers !== 0) {
    warnings.push(
      `Active Prisma save is already mutated: expected seed-like Transfers = 0, got ${counts.transfers}. Projection integrity is still valid; transfer count is treated as informational in the mixed read-only Prisma / editable local model.`,
    );
  }

  if (counts.teamSeasonStates !== 32) {
    errors.push(`Expected TeamSeasonStates = 32, got ${counts.teamSeasonStates}`);
  }

  if (counts.disciplineWeights <= 20) {
    errors.push(`Expected DisciplineWeights > 20, got ${counts.disciplineWeights}`);
  }

  const invalidWeightSums = disciplineWeightAudit.filter((row) => row.weightSum !== 100);
  if (invalidWeightSums.length > 0) {
    errors.push(
      `Expected every discipline weight sum to equal 100, failed for: ${invalidWeightSums
        .map((row) => `${row.disciplineId}=${row.weightSum}`)
        .join(", ")}`,
    );
  }

  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }

  if (warnings.length > 0) {
    console.log("- Warnings:");
    for (const warning of warnings) {
      console.log(`  ${warning}`);
    }
  }

  console.log("Foundation projection check passed.");
}

main()
  .catch((error) => {
    console.error("Foundation projection check failed.");
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
