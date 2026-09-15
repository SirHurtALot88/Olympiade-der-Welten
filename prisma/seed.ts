import { MatchdayStatus, PrismaClient, SaveStatus, SeasonStatus } from "@prisma/client";

import {
  foundationSeedDisciplines,
  foundationSeedMatchdays,
  foundationSeedSeason,
  loadSeedData,
} from "../lib/data/dataAdapter";
import type { TeamIdentity } from "../lib/data/olyDataTypes";
import {
  mapDisciplineRecord,
  mapDisciplineWeightRecord,
  mapPlayerAttributeRecord,
  mapPlayerDisciplineScoreRecords,
  mapPlayerRecord,
  mapSeasonDisciplineConfigRecord,
  mapTeamRecord,
  mapTeamSeasonStateRecord,
} from "../lib/db/seed/mappers";
import {
  disciplineWeightSeedRows,
  seasonDisciplineConfigSeedRows,
} from "../lib/db/seed/seedSources";

const prisma = new PrismaClient();

const INITIAL_SAVE_ID = "save-initial";
const INITIAL_SAVE_NAME = "Initial Foundation Save";
const SMALL_BATCH_SIZE = 25;
const SCORE_BATCH_SIZE = 1000;
const STATE_BATCH_SIZE = 100;

async function runInBatches<T>(
  items: T[],
  batchSize: number,
  runner: (item: T) => Promise<unknown>,
) {
  for (let index = 0; index < items.length; index += batchSize) {
    const batch = items.slice(index, index + batchSize);
    await Promise.all(batch.map((item) => runner(item)));
  }
}

async function createManyInBatches<T>(
  items: T[],
  batchSize: number,
  runner: (batch: T[]) => Promise<unknown>,
) {
  for (let index = 0; index < items.length; index += batchSize) {
    const batch = items.slice(index, index + batchSize);
    await runner(batch);
  }
}

async function seedSaveAndSeason(saveId: string, seasonId: string) {
  await prisma.save.upsert({
    where: { id: saveId },
    update: {
      name: INITIAL_SAVE_NAME,
      status: SaveStatus.active,
    },
    create: {
      id: saveId,
      name: INITIAL_SAVE_NAME,
      status: SaveStatus.active,
    },
  });

  await prisma.season.upsert({
    where: { id: seasonId },
    update: {
      saveId,
      name: foundationSeedSeason.name,
      year: foundationSeedSeason.year,
      currentMatchday: foundationSeedSeason.currentMatchday,
      status: SeasonStatus.active,
    },
    create: {
      id: seasonId,
      saveId,
      name: foundationSeedSeason.name,
      year: foundationSeedSeason.year,
      currentMatchday: foundationSeedSeason.currentMatchday,
      status: SeasonStatus.active,
    },
  });
}

async function seedTeams(seed: ReturnType<typeof loadSeedData>) {
  await runInBatches(seed.teams, SMALL_BATCH_SIZE, async (team) => {
    const record = mapTeamRecord(team);

    await prisma.team.upsert({
      where: { id: record.id },
      update: record,
      create: record,
    });
  });
}

async function seedDisciplinesAndWeights(seasonId: string) {
  await runInBatches(foundationSeedDisciplines, SMALL_BATCH_SIZE, async (discipline) => {
    const record = mapDisciplineRecord(discipline);

    await prisma.discipline.upsert({
      where: { id: record.id },
      update: record,
      create: record,
    });
  });

  await runInBatches(disciplineWeightSeedRows, SCORE_BATCH_SIZE, async (row) => {
    const record = mapDisciplineWeightRecord(row);

    await prisma.disciplineWeight.upsert({
      where: {
        disciplineId_attributeKey_seasonId: {
          disciplineId: row.disciplineId,
          attributeKey: row.attributeKey,
          seasonId,
        },
      },
      update: record,
      create: record,
    });
  });

  // Altbestand wegraeumen: Unique-Key ist (disciplineId, attributeKey, seasonId), `source` ist
  // nur ein unrestriktives Feld darauf. Eine Source-Whitelist (frueher: notIn DISCIPLINE_WEIGHT_
  // SEED_SOURCES) trifft deshalb NICHT, wenn sich innerhalb derselben Source das Attribut-Set
  // einer Disziplin aendert -- z.B. Football faellt von 10 auf 9 Attribute (kein `charisma`
  // mehr) beim Umstieg auf den Spiel-Eignungs-Override, aber die Zeile `football/charisma`
  // traegt weiter die alte, fuer die anderen 19 Disziplinen weiterhin gueltige Source und
  // ueberlebt so jeden Season-Reseed. Stattdessen zielgenau auf (disciplineId, attributeKey)
  // vergleichen: jede Zeile dieser Season, deren Paar NICHT mehr im aktuell berechneten Profil
  // vorkommt, ist Altbestand -- unabhaengig von ihrer Source.
  const currentDisciplineAttributePairs = new Set(
    disciplineWeightSeedRows.map((row) => `${row.disciplineId}::${row.attributeKey}`),
  );
  const existingDisciplineWeightRows = await prisma.disciplineWeight.findMany({
    where: { seasonId },
    select: { disciplineId: true, attributeKey: true },
  });
  const staleDisciplineWeightRows = existingDisciplineWeightRows.filter(
    (row) => !currentDisciplineAttributePairs.has(`${row.disciplineId}::${row.attributeKey}`),
  );

  await runInBatches(staleDisciplineWeightRows, SMALL_BATCH_SIZE, async (row) => {
    await prisma.disciplineWeight.delete({
      where: {
        disciplineId_attributeKey_seasonId: {
          disciplineId: row.disciplineId,
          attributeKey: row.attributeKey,
          seasonId,
        },
      },
    });
  });

  await runInBatches(seasonDisciplineConfigSeedRows, SMALL_BATCH_SIZE, async (row) => {
    const record = mapSeasonDisciplineConfigRecord(row);

    await prisma.seasonDisciplineConfig.upsert({
      where: {
        seasonId_disciplineId: {
          seasonId: row.seasonId,
          disciplineId: row.disciplineId,
        },
      },
      update: record,
      create: record,
    });
  });
}

async function seedPlayers(seed: ReturnType<typeof loadSeedData>) {
  const playerRecords = seed.players.map((player) => mapPlayerRecord(player));
  const playerAttributeRecords = seed.players.map((player) => mapPlayerAttributeRecord(player));
  const allScores = seed.players.flatMap((player) => mapPlayerDisciplineScoreRecords(player, foundationSeedDisciplines));

  await createManyInBatches(playerRecords, SCORE_BATCH_SIZE, async (batch) => {
    await prisma.player.createMany({
      data: batch,
      skipDuplicates: true,
    });
  });

  await createManyInBatches(playerAttributeRecords, SCORE_BATCH_SIZE, async (batch) => {
    await prisma.playerAttribute.createMany({
      data: batch,
      skipDuplicates: true,
    });
  });

  await createManyInBatches(allScores, SCORE_BATCH_SIZE, async (batch) => {
    await prisma.playerDisciplineScore.createMany({
      data: batch,
      skipDuplicates: true,
    });
  });
}

async function seedSeasonState(seed: ReturnType<typeof loadSeedData>, saveId: string, seasonId: string) {
  const teamIdentityById = new Map<string, TeamIdentity>(seed.teamIdentities.map((identity) => [identity.teamId, identity]));
  const teamStateRecords = seed.teams.map((team) =>
    mapTeamSeasonStateRecord({
      saveId,
      seasonId,
      team,
      identity: teamIdentityById.get(team.teamId),
    }),
  );
  const matchdayRecords = foundationSeedMatchdays.map((matchday) => {
    return {
      id: matchday.id,
      seasonId,
      index: matchday.index,
      label: matchday.label,
      status: MatchdayStatus.planning,
      homeTeamId: null,
      awayTeamId: null,
    };
  });

  await createManyInBatches(teamStateRecords, STATE_BATCH_SIZE, async (batch) => {
    await prisma.teamSeasonState.createMany({
      data: batch,
      skipDuplicates: true,
    });
  });

  await createManyInBatches(matchdayRecords, SMALL_BATCH_SIZE, async (batch) => {
    await prisma.matchday.createMany({
      data: batch,
      skipDuplicates: true,
    });
  });
}

async function main() {
  const seed = loadSeedData();
  const seasonId = foundationSeedSeason.id;
  const saveId = INITIAL_SAVE_ID;

  console.log("Seed phase 1/5: save and season");
  await seedSaveAndSeason(saveId, seasonId);
  console.log("Seed phase 2/5: teams");
  await seedTeams(seed);
  console.log("Seed phase 3/5: disciplines, weights, config");
  await seedDisciplinesAndWeights(seasonId);
  console.log("Seed phase 4/5: players, attributes, discipline scores");
  await seedPlayers(seed);
  console.log("Seed phase 5/5: team season state, active players, matchdays");
  await seedSeasonState(seed, saveId, seasonId);

  const counts = {
    teams: await prisma.team.count(),
    players: await prisma.player.count(),
    disciplines: await prisma.discipline.count(),
    disciplineWeights: await prisma.disciplineWeight.count(),
    activePlayers: await prisma.activePlayer.count(),
    transfers: await prisma.transfer.count(),
  };

  const summary = {
    saveId,
    seasonId,
    ...counts,
    seasonDisciplineConfigs: await prisma.seasonDisciplineConfig.count(),
    importedHistoricalTransfers: false,
    importedHistoricalStandings: false,
    importedMarketValueHistory: false,
  };

  console.log("Prisma seed complete");
  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((error) => {
    console.error("Prisma seed failed", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
