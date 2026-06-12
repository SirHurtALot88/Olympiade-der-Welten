import type { GameState, TeamIdentity } from "@/lib/data/olyDataTypes";
import { projectFoundationStateFromPrisma } from "@/lib/db/read/foundation-read-projection";
import { loadFoundationSnapshotFromPrisma } from "@/lib/db/read/foundation-read-repository";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { db } from "@/src/server/db";

type CompareStatus = "PASS" | "WARN" | "FAIL";

type SaveLike = {
  saveId: string;
  name: string;
  status: string;
  gameState: GameState;
};

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function createSeedSignature(gameState: GameState) {
  return JSON.stringify({
    teamCount: gameState.teams.length,
    playerCount: gameState.players.length,
    disciplineCount: gameState.disciplines.length,
    rosterCount: gameState.rosters.length,
    disciplineConfig: [...gameState.disciplines]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((discipline) => ({
        id: discipline.id,
        displayOrder: discipline.displayOrder ?? null,
        originalOrder: discipline.originalOrder ?? null,
        playerCount: discipline.playerCount ?? null,
        mutator1: discipline.mutator1 ?? null,
        mutator2: discipline.mutator2 ?? null,
      })),
  });
}

function summarizeSave(save: { saveId: string; name: string; status: string }) {
  return `${save.name} (${save.saveId}) [${save.status}]`;
}

function getTeamIdentityMap(gameState: GameState) {
  return new Map(gameState.teamIdentities.map((identity) => [identity.teamId, identity]));
}

function compareTeamIdentity(left?: TeamIdentity, right?: TeamIdentity) {
  if (!left || !right) {
    return left === right;
  }

  return (
    left.pow === right.pow &&
    left.spe === right.spe &&
    left.men === right.men &&
    left.soc === right.soc &&
    left.ambition === right.ambition &&
    left.finances === right.finances &&
    left.boardConfidence === right.boardConfidence &&
    left.harmony === right.harmony &&
    left.manners === right.manners &&
    left.popularity === right.popularity &&
    left.cooperation === right.cooperation &&
    left.playerMin === right.playerMin &&
    left.playerOpt === right.playerOpt
  );
}

async function loadPrismaSaves() {
  const saves = await db.save.findMany({
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
  });

  const projections: SaveLike[] = [];
  for (const save of saves) {
    const snapshot = await loadFoundationSnapshotFromPrisma(save.id);
    if (!snapshot) {
      continue;
    }

    const projection = projectFoundationStateFromPrisma(snapshot).save;
    projections.push({
      saveId: projection.saveId,
      name: projection.name,
      status: projection.status,
      gameState: projection.gameState,
    });
  }

  return projections;
}

function selectMatchingSave(sqliteSaves: SaveLike[], prismaSaves: SaveLike[]) {
  const prismaById = new Map(prismaSaves.map((save) => [save.saveId, save]));
  for (const sqliteSave of sqliteSaves) {
    const byId = prismaById.get(sqliteSave.saveId);
    if (byId) {
      return {
        mode: "id" as const,
        sqlite: sqliteSave,
        prisma: byId,
      };
    }
  }

  const prismaByNameSlug = new Map(prismaSaves.map((save) => [slugify(save.name), save]));
  for (const sqliteSave of sqliteSaves) {
    const byName = prismaByNameSlug.get(slugify(sqliteSave.name));
    if (byName) {
      return {
        mode: "name" as const,
        sqlite: sqliteSave,
        prisma: byName,
      };
    }
  }

  for (const sqliteSave of sqliteSaves) {
    const sqliteSignature = createSeedSignature(sqliteSave.gameState);
    for (const prismaSave of prismaSaves) {
      const prismaSignature = createSeedSignature(prismaSave.gameState);
      if (sqliteSignature === prismaSignature) {
        return {
          mode: "seed-shape" as const,
          sqlite: sqliteSave,
          prisma: prismaSave,
        };
      }
    }
  }

  return null;
}

function compareStates(sqliteSave: SaveLike, prismaSave: SaveLike) {
  const warnings: string[] = [];
  const failures: string[] = [];
  const sqliteState = sqliteSave.gameState;
  const prismaState = prismaSave.gameState;

  const countChecks = [
    ["Teams", sqliteState.teams.length, prismaState.teams.length],
    ["Players", sqliteState.players.length, prismaState.players.length],
    ["Disciplines", sqliteState.disciplines.length, prismaState.disciplines.length],
    ["ActivePlayers/Rosters", sqliteState.rosters.length, prismaState.rosters.length],
    ["TeamSeasonState/TeamIdentities", sqliteState.teamIdentities.length, prismaState.teamIdentities.length],
  ] as const;

  for (const [label, left, right] of countChecks) {
    if (left !== right) {
      failures.push(`${label} mismatch: sqlite=${left}, prisma=${right}`);
    }
  }

  const prismaTeamsById = new Map(prismaState.teams.map((team) => [team.teamId, team]));
  const prismaTeamIdentityById = getTeamIdentityMap(prismaState);
  for (const sqliteTeam of sqliteState.teams) {
    const prismaTeam = prismaTeamsById.get(sqliteTeam.teamId);
    if (!prismaTeam) {
      failures.push(`Missing team in prisma projection: ${sqliteTeam.teamId}`);
      continue;
    }

    const sqliteIdentity = getTeamIdentityMap(sqliteState).get(sqliteTeam.teamId);
    const prismaIdentity = prismaTeamIdentityById.get(sqliteTeam.teamId);

    const fieldChecks = [
      ["cash", sqliteTeam.cash, prismaTeam.cash],
      ["budget", sqliteTeam.budget, prismaTeam.budget],
      ["rosterLimit", sqliteTeam.rosterLimit, prismaTeam.rosterLimit],
      ["humanControlled", Number(sqliteTeam.humanControlled), Number(prismaTeam.humanControlled)],
    ] as const;

    for (const [field, left, right] of fieldChecks) {
      if (left !== right) {
        failures.push(`Team ${sqliteTeam.teamId} field ${field} mismatch: sqlite=${left}, prisma=${right}`);
      }
    }

    if (!compareTeamIdentity(sqliteIdentity, prismaIdentity)) {
      failures.push(`Team identity mismatch for ${sqliteTeam.teamId}`);
    }
  }

  const sqliteDisciplines = [...sqliteState.disciplines]
    .map((discipline) => ({
      id: discipline.id,
      displayOrder: discipline.displayOrder ?? null,
      originalOrder: discipline.originalOrder ?? null,
      playerCount: discipline.playerCount ?? null,
      mutator1: discipline.mutator1 ?? null,
      mutator2: discipline.mutator2 ?? null,
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
  const prismaDisciplines = [...prismaState.disciplines]
    .map((discipline) => ({
      id: discipline.id,
      displayOrder: discipline.displayOrder ?? null,
      originalOrder: discipline.originalOrder ?? null,
      playerCount: discipline.playerCount ?? null,
      mutator1: discipline.mutator1 ?? null,
      mutator2: discipline.mutator2 ?? null,
    }))
    .sort((left, right) => left.id.localeCompare(right.id));

  if (JSON.stringify(sqliteDisciplines) !== JSON.stringify(prismaDisciplines)) {
    failures.push("Discipline configuration mismatch between sqlite and prisma.");
  }

  if (sqliteState.transferHistory.length !== 0 || prismaState.transferHistory.length !== 0) {
    warnings.push(
      `Expected no transfer history in aligned comparison, got sqlite=${sqliteState.transferHistory.length}, prisma=${prismaState.transferHistory.length}.`,
    );
  }

  return { warnings, failures };
}

async function main() {
  const persistence = createPersistenceService();
  const sqliteSummaries = persistence.listSaves();
  const sqliteSaves = sqliteSummaries
    .map((summary) => persistence.getSaveById(summary.saveId))
    .filter((save): save is NonNullable<typeof save> => Boolean(save))
    .map((save) => ({
      saveId: save.saveId,
      name: save.name,
      status: save.status,
      gameState: save.gameState,
    }));

  const prismaSaves = await loadPrismaSaves();

  console.log("Foundation source comparison (state-aligned)");
  console.log("- SQLite saves:");
  sqliteSaves.forEach((save) => console.log(`  - ${summarizeSave(save)}`));
  console.log("- Prisma saves:");
  prismaSaves.forEach((save) => console.log(`  - ${summarizeSave(save)}`));

  if (sqliteSaves.length === 0) {
    throw new Error("No sqlite saves found.");
  }

  if (prismaSaves.length === 0) {
    throw new Error("No prisma saves found.");
  }

  const match = selectMatchingSave(sqliteSaves, prismaSaves);
  if (!match || match.mode === "seed-shape") {
    console.log("WARN: no matching save");
    if (match?.mode === "seed-shape") {
      console.log(
        `The sources share the same general foundation shape, but not the same stable save identity. SQLite is using ${summarizeSave(match.sqlite)} while Prisma is using ${summarizeSave(match.prisma)}.`,
      );
    }
    console.log(
      "No shared save ID or stable save name exists across SQLite and Prisma. Differences like cash/delta may be expected when the two sources point at different save states.",
    );
    console.log("PASS/WARN RESULT: WARN");
    return;
  }

  console.log(`- Matched save by ${match.mode}:`);
  console.log(`  SQLite: ${summarizeSave(match.sqlite)}`);
  console.log(`  Prisma: ${summarizeSave(match.prisma)}`);

  const { warnings, failures } = compareStates(match.sqlite, match.prisma);

  for (const warning of warnings) {
    console.log(`WARN: ${warning}`);
  }

  if (failures.length > 0) {
    console.log("FAIL: projection/mapping mismatches detected");
    failures.forEach((failure) => console.log(`  - ${failure}`));
    process.exitCode = 1;
    return;
  }

  console.log("PASS: aligned sqlite/prisma save comparison shows no projection or mapping mismatches.");
}

main()
  .catch((error) => {
    console.error("Foundation source comparison failed.");
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
