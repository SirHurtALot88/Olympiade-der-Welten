import path from "node:path";

import { loadEnvConfig } from "@next/env";

import { calculateLocalLegacyLineupPreview, loadLocalLegacyLineupContext, saveLocalLegacyLineupDraft } from "@/lib/lineups/legacy-lineup-local-service";
import type { LegacyLineupEntryInput, LegacyLineupKeyParams } from "@/lib/lineups/legacy-lineup-types";
import { createPersistenceService } from "@/lib/persistence/persistence-service";

type CandidateEntry = {
  activePlayerId: string;
  playerId: string;
  score: number;
};

function combinations<T>(items: T[], count: number): T[][] {
  if (count === 0) {
    return [[]];
  }
  if (items.length < count) {
    return [];
  }

  const result: T[][] = [];
  for (let index = 0; index <= items.length - count; index += 1) {
    const head = items[index];
    const tails = combinations(items.slice(index + 1), count - 1);
    for (const tail of tails) {
      result.push([head, ...tail]);
    }
  }
  return result;
}

function sumScores(entries: CandidateEntry[]) {
  return entries.reduce((sum, entry) => sum + entry.score, 0);
}

function buildEntriesForSide(input: {
  disciplineId: string;
  disciplineSide: "d1" | "d2";
  candidates: CandidateEntry[];
}): LegacyLineupEntryInput[] {
  return input.candidates.map((candidate, index) => ({
    disciplineId: input.disciplineId,
    disciplineSide: input.disciplineSide,
    slotIndex: index,
    playerId: candidate.playerId,
    activePlayerId: candidate.activePlayerId,
    isCaptain: index === 0,
  }));
}

function selectBestDisjointLineup(input: {
  d1PlayerCount: number;
  d2PlayerCount: number;
  d1Candidates: CandidateEntry[];
  d2Candidates: CandidateEntry[];
}) {
  const d1Combos = combinations(input.d1Candidates, input.d1PlayerCount);
  const d2Combos = combinations(input.d2Candidates, input.d2PlayerCount);

  let best:
    | {
        d1: CandidateEntry[];
        d2: CandidateEntry[];
        total: number;
      }
    | null = null;

  for (const d1 of d1Combos) {
    const usedIds = new Set(d1.map((entry) => entry.activePlayerId));
    for (const d2 of d2Combos) {
      if (d2.some((entry) => usedIds.has(entry.activePlayerId))) {
        continue;
      }
      const total = sumScores(d1) + sumScores(d2);
      if (!best || total > best.total) {
        best = { d1, d2, total };
      }
    }
  }

  return best;
}

function parseArgs(argv: string[]) {
  const getValue = (flag: string, fallback?: string) => {
    const index = argv.indexOf(flag);
    return index >= 0 ? (argv[index + 1] ?? fallback ?? "") : fallback ?? "";
  };

  return {
    source: (getValue("--source", "sqlite") === "prisma" ? "prisma" : "sqlite") as "sqlite" | "prisma",
    saveId: getValue("--saveId"),
    seasonId: getValue("--seasonId"),
    matchdayId: getValue("--matchdayId"),
    teamId: getValue("--teamId"),
  };
}

function resolveLocalSmokeParams(input: {
  saveId?: string;
  seasonId?: string;
  matchdayId?: string;
  teamId?: string;
}) {
  const persistence = createPersistenceService();
  const previousActiveSave = persistence.getActiveSave();
  const smokeSave = persistence.createFreshSeasonOneSave({
    name: `Lineup Smoke ${new Date().toLocaleString("de-DE")}`,
  });
  const save = input.saveId ? persistence.getSaveById(input.saveId) ?? smokeSave : smokeSave;
  const seasonId = input.seasonId && input.seasonId === save.gameState.season.id ? input.seasonId : save.gameState.season.id;
  const matchdayId =
    input.matchdayId && save.gameState.season.matchdayIds.includes(input.matchdayId)
      ? input.matchdayId
      : save.gameState.matchdayState.matchdayId;
  const teamId =
    input.teamId && save.gameState.teams.some((team) => team.teamId === input.teamId)
      ? input.teamId
      : save.gameState.teams.find((team) => {
          const rosterCount = save.gameState.rosters.filter((entry) => entry.teamId === team.teamId).length;
          return rosterCount >= 7;
        })?.teamId ??
        save.gameState.teams[0]?.teamId;

  if (!teamId) {
    throw new Error(`No team available in local save ${save.saveId}.`);
  }

  return {
    params: {
      saveId: save.saveId,
      seasonId,
      matchdayId,
      teamId,
    } satisfies LegacyLineupKeyParams,
    saveIdToRestore: previousActiveSave?.saveId ?? null,
  };
}

async function runLocalSmoke(input: {
  saveId?: string;
  seasonId?: string;
  matchdayId?: string;
  teamId?: string;
}) {
  const persistence = createPersistenceService();
  const { params, saveIdToRestore } = resolveLocalSmokeParams(input);

  try {
    const contextResult = loadLocalLegacyLineupContext(params);
    if (!contextResult.ok) {
      throw new Error(`Legacy local context could not be loaded: ${contextResult.errors.join(" | ")}`);
    }

    const { context } = contextResult;
    const d1 = context.matchdayContract?.discipline1;
    const d2 = context.matchdayContract?.discipline2;
    if (!d1 || !d2 || !d1.requiredPlayers || !d2.requiredPlayers) {
      throw new Error("Matchday lineup contract could not resolve both discipline sides with required players.");
    }

    const scoreMap = new Map(context.disciplineScores.map((score) => [`${score.playerId}::${score.disciplineId}`, score.score] as const));
    const d1Candidates = context.activePlayers
      .map((player) => ({
        activePlayerId: player.id,
        playerId: player.playerId,
        score: scoreMap.get(`${player.playerId}::${d1.disciplineId}`),
      }))
      .filter((entry): entry is CandidateEntry => typeof entry.score === "number")
      .sort((left, right) => right.score - left.score);

    const d2Candidates = context.activePlayers
      .map((player) => ({
        activePlayerId: player.id,
        playerId: player.playerId,
        score: scoreMap.get(`${player.playerId}::${d2.disciplineId}`),
      }))
      .filter((entry): entry is CandidateEntry => typeof entry.score === "number")
      .sort((left, right) => right.score - left.score);

    if (d1Candidates.length < d1.requiredPlayers || d2Candidates.length < d2.requiredPlayers) {
      throw new Error(
        `Not enough scored active players for smoke lineup: ${d1.disciplineId}=${d1Candidates.length}/${d1.requiredPlayers}, ${d2.disciplineId}=${d2Candidates.length}/${d2.requiredPlayers}.`,
      );
    }

    const best = selectBestDisjointLineup({
      d1PlayerCount: d1.requiredPlayers,
      d2PlayerCount: d2.requiredPlayers,
      d1Candidates,
      d2Candidates,
    });

    if (!best) {
      throw new Error(`Could not build a valid disjoint D1/D2 lineup for team ${params.teamId}.`);
    }

    const entries = [
      ...buildEntriesForSide({ disciplineId: d1.disciplineId, disciplineSide: "d1", candidates: best.d1 }),
      ...buildEntriesForSide({ disciplineId: d2.disciplineId, disciplineSide: "d2", candidates: best.d2 }),
    ];

    const saveResult = saveLocalLegacyLineupDraft(params, entries);
    if (!saveResult.ok) {
      throw new Error(`Initial draft save failed: ${saveResult.errors.join(" | ")}`);
    }

    const preview = calculateLocalLegacyLineupPreview(params);
    if (!preview.ok) {
      throw new Error(`Draft preview could not be calculated: ${preview.errors.join(" | ")}`);
    }

    const uniqueSlotKeys = new Set(
      saveResult.draft.entries.map((entry) => `${entry.disciplineId}::${entry.disciplineSide}::${entry.slotIndex}`),
    );
    const duplicateSlotCount = saveResult.draft.entries.length - uniqueSlotKeys.size;

    console.log("Legacy lineup smoke test");
    console.log(`source: sqlite`);
    console.log(`saveId: ${params.saveId}`);
    console.log(`seasonId: ${params.seasonId}`);
    console.log(`matchdayId: ${params.matchdayId}`);
    console.log(`teamId: ${params.teamId}`);
    console.log(`teamName: ${context.team.name}`);
    console.log(`d1: ${d1.disciplineId} (${d1.requiredPlayers})`);
    console.log(`d2: ${d2.disciplineId} (${d2.requiredPlayers})`);
    console.log(`activePlayers: ${context.activePlayers.length}`);
    console.log(`savedSlots: ${saveResult.draft.entries.length}`);
    console.log(
      `previewSideScores: ${preview.scorePreview.entries.length > 0
        ? [d1, d2]
            .map((slot) => {
              const sideScore = preview.scorePreview.entries
                .filter((entry) => entry.disciplineId === slot.disciplineId && entry.disciplineSide === slot.disciplineSide)
                .reduce((sum, entry) => sum + (entry.score ?? 0), 0);
              return `${slot.disciplineSide}:${slot.disciplineId}=${sideScore}`;
            })
            .join(", ")
        : "none"}`,
    );
    console.log(`previewTotalScore: ${preview.scorePreview.totalScore}`);
    console.log(`validationWarnings: ${preview.scorePreview.validationWarnings.length}`);
    console.log(`missingScores: ${preview.scorePreview.missingScores.length}`);
    console.log(`duplicateSlotsCreated: ${duplicateSlotCount > 0 ? "yes" : "no"}`);
    if (preview.scorePreview.validationWarnings.length > 0) {
      console.log(`warningsDetail: ${preview.scorePreview.validationWarnings.join(" | ")}`);
    }
  } finally {
    if (saveIdToRestore) {
      persistence.activateSave(saveIdToRestore);
    }
  }
}

async function runPrismaReadOnlySmoke(input: {
  saveId?: string;
  seasonId?: string;
  matchdayId?: string;
  teamId?: string;
}) {
  loadEnvConfig(path.resolve(__dirname, ".."));
  const { db } = await import("@/src/server/db");
  const { LegacyLineupContextLoader, buildLegacyLineupPreview } = await import("@/lib/lineups/legacy-lineup-context-loader");
  const { LegacyLineupRepository } = await import("@/lib/lineups/legacy-lineup-repository");

  const save =
    (input.saveId ? await db.save.findUnique({ where: { id: input.saveId } }) : null) ??
    (await db.save.findUnique({ where: { id: "save-initial" } })) ??
    (await db.save.findFirst({ where: { status: "active" }, orderBy: [{ updatedAt: "desc" }] })) ??
    (await db.save.findFirst({ orderBy: [{ updatedAt: "desc" }] }));

  if (!save) {
    throw new Error("No Prisma save found for legacy lineup smoke test.");
  }

  const season =
    (input.seasonId
      ? await db.season.findFirst({ where: { id: input.seasonId, saveId: save.id } })
      : null) ??
    (await db.season.findFirst({ where: { saveId: save.id }, orderBy: [{ year: "asc" }] }));
  if (!season) {
    throw new Error(`No season found for save ${save.id}.`);
  }

  const matchday =
    (input.matchdayId
      ? await db.matchday.findFirst({ where: { id: input.matchdayId, seasonId: season.id } })
      : null) ??
    (await db.matchday.findFirst({ where: { seasonId: season.id }, orderBy: [{ index: "asc" }] }));
  if (!matchday) {
    throw new Error(`No matchday found for season ${season.id}.`);
  }

  const teamState =
    (input.teamId
      ? await db.teamSeasonState.findUnique({
          where: {
            saveId_seasonId_teamId: {
              saveId: save.id,
              seasonId: season.id,
              teamId: input.teamId,
            },
          },
        })
      : null) ??
    (await db.teamSeasonState.findFirst({
      where: { saveId: save.id, seasonId: season.id },
      orderBy: [{ teamId: "asc" }],
    }));
  if (!teamState) {
    throw new Error(`No teamSeasonState found for save ${save.id} and season ${season.id}.`);
  }

  const params: LegacyLineupKeyParams = {
    saveId: save.id,
    seasonId: season.id,
    matchdayId: matchday.id,
    teamId: teamState.teamId,
  };

  const repository = new LegacyLineupRepository(db);
  const loader = new LegacyLineupContextLoader(db, repository);
  const contextResult = await loader.loadLegacyLineupContext(params);
  if (!contextResult.ok) {
    throw new Error(`Legacy context could not be loaded: ${contextResult.errors.join(" | ")}`);
  }

  const preview = await buildLegacyLineupPreview(params, contextResult.context.existingDraft?.entries ?? []);
  if (!preview.ok) {
    throw new Error(`Legacy preview could not be calculated: ${preview.errors.join(" | ")}`);
  }

  console.log("Legacy lineup smoke test");
  console.log(`source: prisma`);
  console.log(`saveId: ${params.saveId}`);
  console.log(`seasonId: ${params.seasonId}`);
  console.log(`matchdayId: ${params.matchdayId}`);
  console.log(`teamId: ${params.teamId}`);
  console.log(`teamName: ${contextResult.context.team.name}`);
  console.log(`existingLineup: ${contextResult.context.existingDraft ? "yes" : "no"}`);
  console.log(`previewTotalScore: ${preview.scorePreview.totalScore}`);
  console.log(`validationWarnings: ${preview.scorePreview.validationWarnings.length}`);
  console.log(`readOnly: yes`);

  await db.$disconnect();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.source === "prisma") {
    await runPrismaReadOnlySmoke(args);
    return;
  }

  await runLocalSmoke(args);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
