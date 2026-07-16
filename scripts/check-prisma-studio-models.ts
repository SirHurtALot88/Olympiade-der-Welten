import { loadEnvConfig } from "@next/env";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

loadEnvConfig(path.resolve(__dirname, ".."));

const prisma = new PrismaClient();

const modelReaders: Record<string, () => Promise<unknown>> = {
  Save: () => prisma.save.findMany({ take: 3 }),
  Season: () => prisma.season.findMany({ take: 3 }),
  Team: () => prisma.team.findMany({ take: 3 }),
  TeamSeasonState: () => prisma.teamSeasonState.findMany({ take: 3 }),
  Player: () => prisma.player.findMany({ take: 3 }),
  PlayerAttribute: () => prisma.playerAttribute.findMany({ take: 3 }),
  PlayerDisciplineScore: () => prisma.playerDisciplineScore.findMany({ take: 3 }),
  ActivePlayer: () => prisma.activePlayer.findMany({ take: 3 }),
  Discipline: () => prisma.discipline.findMany({ take: 3 }),
  DisciplineWeight: () => prisma.disciplineWeight.findMany({ take: 3 }),
  SeasonDisciplineConfig: () => prisma.seasonDisciplineConfig.findMany({ take: 3 }),
  Matchday: () => prisma.matchday.findMany({ take: 3 }),
  Lineup: () => prisma.lineup.findMany({ take: 3 }),
  LineupSlot: () =>
    prisma.lineupSlot.findMany({
      take: 5,
      include: { discipline: true, lineup: true, player: true, activePlayer: true },
    }),
  MatchdayResult: () => prisma.matchdayResult.findMany({ take: 3 }),
  DisciplineResult: () => prisma.disciplineResult.findMany({ take: 3 }),
  PlayerDisciplinePerformance: () => prisma.playerDisciplinePerformance.findMany({ take: 3 }),
  DisciplineHighlight: () => prisma.disciplineHighlight.findMany({ take: 3 }),
  ResultAuditLog: () => prisma.resultAuditLog.findMany({ take: 3 }),
  Transfer: () => prisma.transfer.findMany({ take: 3 }),
};

async function main() {
  const failures: Array<{ model: string; message: string }> = [];

  for (const [model, read] of Object.entries(modelReaders)) {
    try {
      const rows = await read();
      const count = Array.isArray(rows) ? rows.length : 0;
      console.log(`OK ${model} ${count}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push({ model, message });
      console.log(`ERR ${model} ${message.split("\n")[0]}`);
    }
  }

  if (failures.length > 0) {
    throw new Error(
      `Prisma model read smoke failed for: ${failures.map((failure) => failure.model).join(", ")}`,
    );
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

