import path from "node:path";

import { loadEnvConfig } from "@next/env";

import { loadFoundationSnapshotFromPrisma } from "@/lib/db/read/foundation-read-repository";
import { buildLegacyMatchdayResolvePreview } from "@/lib/resolve/legacy-matchday-resolve-engine";
import { loadLocalLegacyLineupContext, saveLocalLegacyLineupDraft } from "@/lib/lineups/legacy-lineup-local-service";
import type { LegacyLineupEntryInput, LegacyLineupKeyParams } from "@/lib/lineups/legacy-lineup-types";
import { createPersistenceService } from "@/lib/persistence/persistence-service";

type CandidateEntry = {
  activePlayerId: string;
  playerId: string;
  score: number;
};

function combinations<T>(items: T[], count: number): T[][] {
  if (count === 0) return [[]];
  if (items.length < count) return [];

  const result: T[][] = [];
  for (let index = 0; index <= items.length - count; index += 1) {
    const head = items[index];
    if (!head) continue;
    for (const tail of combinations(items.slice(index + 1), count - 1)) {
      result.push([head, ...tail]);
    }
  }
  return result;
}

function sumScores(entries: CandidateEntry[]) {
  return entries.reduce((sum, entry) => sum + entry.score, 0);
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
      if (d2.some((entry) => usedIds.has(entry.activePlayerId))) continue;
      const total = sumScores(d1) + sumScores(d2);
      if (!best || total > best.total) {
        best = { d1, d2, total };
      }
    }
  }

  return best;
}

function buildEntriesForSide(input: {
  disciplineId: string;
  disciplineSide: "d1" | "d2";
  candidates: CandidateEntry[];
  includeCaptain?: boolean;
}) {
  return input.candidates.map<LegacyLineupEntryInput>((candidate, index) => ({
    disciplineId: input.disciplineId,
    disciplineSide: input.disciplineSide,
    slotIndex: index,
    playerId: candidate.playerId,
    activePlayerId: candidate.activePlayerId,
    isCaptain: input.includeCaptain ? index === 0 : false,
  }));
}

function buildEntriesFromContext(
  params: LegacyLineupKeyParams,
  options?: {
    incomplete?: boolean;
    includeCaptains?: boolean;
  },
) {
  const incomplete = options?.incomplete ?? false;
  const includeCaptains = options?.includeCaptains ?? true;
  const contextResult = loadLocalLegacyLineupContext(params);
  if (!contextResult.ok) {
    throw new Error(`Local resolve smoke context missing for ${params.teamId}: ${contextResult.errors.join(" | ")}`);
  }

  const context = contextResult.context;
  const d1 = context.matchdayContract?.discipline1;
  const d2 = context.matchdayContract?.discipline2;
  if (!d1 || !d2 || !d1.requiredPlayers || !d2.requiredPlayers) {
    throw new Error(`D1/D2 context missing for ${params.teamId}.`);
  }

  const scoreMap = new Map(context.disciplineScores.map((entry) => [`${entry.playerId}::${entry.disciplineId}`, entry.score] as const));
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

  const best = selectBestDisjointLineup({
    d1PlayerCount: d1.requiredPlayers,
    d2PlayerCount: d2.requiredPlayers,
    d1Candidates,
    d2Candidates,
  });
  if (!best) {
    throw new Error(`Could not build a valid lineup for ${params.teamId}.`);
  }

  const d2CandidatesForSave = incomplete ? best.d2.slice(0, Math.max(0, best.d2.length - 1)) : best.d2;
  return [
    ...buildEntriesForSide({
      disciplineId: d1.disciplineId,
      disciplineSide: "d1",
      candidates: best.d1,
      includeCaptain: includeCaptains,
    }),
    ...buildEntriesForSide({
      disciplineId: d2.disciplineId,
      disciplineSide: "d2",
      candidates: d2CandidatesForSave,
      includeCaptain: includeCaptains,
    }),
  ];
}

function canBuildEntriesForSmoke(params: LegacyLineupKeyParams) {
  try {
    buildEntriesFromContext(params, { includeCaptains: false });
    return true;
  } catch {
    return false;
  }
}

async function main() {
  loadEnvConfig(path.resolve(__dirname, ".."));

  const prismaBefore = await loadFoundationSnapshotFromPrisma("save-initial");
  const prismaBeforeActivePlayers = prismaBefore?.activePlayers.length ?? null;
  const prismaBeforeTeamStates = prismaBefore?.teamSeasonStates.length ?? null;

  const persistence = createPersistenceService();
  const previousActiveSave = persistence.getActiveSave();
  const smokeSave = persistence.createFreshSeasonOneSave({
    name: `Resolve Preview Smoke ${new Date().toLocaleString("de-DE")}`,
  });

  try {
    const seasonId = smokeSave.gameState.season.id;
    const [matchday1, matchday2] = smokeSave.gameState.season.matchdayIds;
    if (!matchday1 || !matchday2) {
      throw new Error("Resolve smoke expected at least two matchdays.");
    }

    const eligibleTeams = smokeSave.gameState.teams
      .filter((team) => {
        const rosterCount = smokeSave.gameState.rosters.filter((entry) => entry.teamId === team.teamId).length;
        if (rosterCount < 7) {
          return false;
        }
        return canBuildEntriesForSmoke({
          saveId: smokeSave.saveId,
          seasonId,
          matchdayId: matchday1,
          teamId: team.teamId,
        }) &&
          canBuildEntriesForSmoke({
            saveId: smokeSave.saveId,
            seasonId,
            matchdayId: matchday2,
            teamId: team.teamId,
          });
      })
      .slice(0, 4);

    if (eligibleTeams.length < 4) {
      throw new Error(`Resolve smoke expected at least 4 eligible teams, got ${eligibleTeams.length}.`);
    }

    const completeTeams = eligibleTeams.slice(0, 3);
    const incompleteTeam = eligibleTeams[3]!;

    for (const team of completeTeams) {
      const matchday1Params: LegacyLineupKeyParams = {
        saveId: smokeSave.saveId,
        seasonId,
        matchdayId: matchday1,
        teamId: team.teamId,
      };
      const matchday2Params: LegacyLineupKeyParams = {
        saveId: smokeSave.saveId,
        seasonId,
        matchdayId: matchday2,
        teamId: team.teamId,
      };
      const firstEntries = buildEntriesFromContext(matchday1Params, { includeCaptains: false });
      const firstSave = saveLocalLegacyLineupDraft(matchday1Params, firstEntries);
      if (!firstSave.ok) {
        throw new Error(`Resolve smoke failed to save matchday-1 lineup for ${team.teamId}: ${firstSave.errors.join(" | ")}`);
      }
    }

    const advancedForPreview = persistence.getSaveById(smokeSave.saveId);
    if (!advancedForPreview) {
      throw new Error("Resolve smoke could not reload the local save after matchday-1 lineups.");
    }
    persistence.saveSingleplayerState(smokeSave.saveId, {
      ...advancedForPreview.gameState,
      season: {
        ...advancedForPreview.gameState.season,
        currentMatchday: 2,
      },
      matchdayState: {
        ...advancedForPreview.gameState.matchdayState,
        matchdayId: matchday2,
      },
    });

    for (const team of completeTeams) {
      const matchday2Params: LegacyLineupKeyParams = {
        saveId: smokeSave.saveId,
        seasonId,
        matchdayId: matchday2,
        teamId: team.teamId,
      };
      const secondEntries = buildEntriesFromContext(matchday2Params, { includeCaptains: true });
      const secondSave = saveLocalLegacyLineupDraft(matchday2Params, secondEntries);
      if (!secondSave.ok) {
        throw new Error(`Resolve smoke failed to save matchday-2 lineup for ${team.teamId}: ${secondSave.errors.join(" | ")}`);
      }
    }

    const incompleteParams: LegacyLineupKeyParams = {
      saveId: smokeSave.saveId,
      seasonId,
      matchdayId: matchday2,
      teamId: incompleteTeam.teamId,
    };
    const incompleteEntries = buildEntriesFromContext(incompleteParams, { incomplete: true, includeCaptains: true });
    const incompleteSave = saveLocalLegacyLineupDraft(incompleteParams, incompleteEntries);
    if (!incompleteSave.ok) {
      throw new Error(`Resolve smoke failed to save incomplete lineup for ${incompleteTeam.teamId}.`);
    }

    const contexts = smokeSave.gameState.teams.map((team) =>
      loadLocalLegacyLineupContext({
        saveId: smokeSave.saveId,
        seasonId,
        matchdayId: matchday2,
        teamId: team.teamId,
      }),
    );
    const okContexts = contexts.flatMap((entry) => (entry.ok ? [entry.context] : []));
    if (okContexts.length !== 32) {
      throw new Error(`Resolve smoke expected 32 loaded team contexts, got ${okContexts.length}.`);
    }

    const preview = buildLegacyMatchdayResolvePreview(okContexts);
    const d1Preview = preview.disciplinePreviews.find((entry) => entry.disciplineSide === "d1");
    const d2Preview = preview.disciplinePreviews.find((entry) => entry.disciplineSide === "d2");
    if (!d1Preview || !d2Preview) {
      throw new Error("Resolve smoke expected both D1 and D2 previews.");
    }

    const incompletePreviewTeam = preview.teamResults.find((team) => team.teamId === incompleteTeam.teamId);
    if (!incompletePreviewTeam || incompletePreviewTeam.status !== "incomplete_lineups") {
      throw new Error(`Resolve smoke expected incomplete status for ${incompleteTeam.teamId}.`);
    }

    if (preview.missingLineups.length === 0) {
      throw new Error("Resolve smoke expected at least one missing lineup team.");
    }

    const topPlayersSorted =
      d1Preview.topPlayers.every((player, index, array) => index === 0 || array[index - 1]!.finalPlayerScore >= player.finalPlayerScore) &&
      d2Preview.topPlayers.every((player, index, array) => index === 0 || array[index - 1]!.finalPlayerScore >= player.finalPlayerScore);
    if (!topPlayersSorted) {
      throw new Error("Resolve smoke found unsorted top players.");
    }

    const fatiguedTeam = preview.teamResults.find((team) => completeTeams.some((candidate) => candidate.teamId === team.teamId) && team.status === "ready");
    if (!fatiguedTeam) {
      throw new Error("Resolve smoke expected at least one ready team.");
    }
    const fatiguedD1 = d1Preview.teamResults.find((team) => team.teamId === fatiguedTeam.teamId);
    const fatiguedD2 = d2Preview.teamResults.find((team) => team.teamId === fatiguedTeam.teamId);
    if (!fatiguedD1 || !fatiguedD2) {
      throw new Error(`Resolve smoke missing discipline rows for ${fatiguedTeam.teamId}.`);
    }
    if ((fatiguedD1.fatigueModifier ?? 0) >= 0 && (fatiguedD2.fatigueModifier ?? 0) >= 0) {
      throw new Error(`Resolve smoke expected fatigue penalty for ready team ${fatiguedTeam.teamId}.`);
    }
    const d1Expected = Number(((fatiguedD1.baseScore ?? 0) + (fatiguedD1.captainBonus ?? 0) + (fatiguedD1.fatigueModifier ?? 0)).toFixed(1));
    const d2Expected = Number(((fatiguedD2.baseScore ?? 0) + (fatiguedD2.captainBonus ?? 0) + (fatiguedD2.fatigueModifier ?? 0)).toFixed(1));
    if (fatiguedD1.finalPreviewScore !== d1Expected || fatiguedD2.finalPreviewScore !== d2Expected) {
      throw new Error(`Resolve smoke final preview mismatch for ${fatiguedTeam.teamId}.`);
    }

    const modifierFieldsOkay = [d1Preview, d2Preview].every((discipline) =>
      discipline.teamResults.every((team) => team.formModifier === 0 && team.mutatorModifier === 0),
    );
    if (!modifierFieldsOkay) {
      throw new Error("Resolve smoke expected form/mutator modifiers to stay at 0 without a selected card or mutator.");
    }

    console.log("Resolve preview smoke");
    console.log(`source: sqlite`);
    console.log(`saveId: ${smokeSave.saveId}`);
    console.log(`seasonId: ${seasonId}`);
    console.log(`matchdayId: ${matchday2}`);
    console.log(`teamsLoaded: ${preview.teamResults.length}`);
    console.log(`previewStatus: ${preview.status}`);
    console.log(`d1: ${d1Preview.disciplineId} top=${d1Preview.topPlayers[0]?.playerName ?? "—"} score=${d1Preview.topPlayers[0]?.finalPlayerScore ?? "—"}`);
    console.log(`d2: ${d2Preview.disciplineId} top=${d2Preview.topPlayers[0]?.playerName ?? "—"} score=${d2Preview.topPlayers[0]?.finalPlayerScore ?? "—"}`);
    console.log(`readyTeams: ${preview.teamResults.filter((team) => team.status === "ready").length}`);
    console.log(`incompleteTeams: ${preview.teamResults.filter((team) => team.status === "incomplete_lineups").length}`);
    console.log(`missingLineups: ${preview.missingLineups.length}`);
    console.log(`missingScores: ${preview.missingScores.length}`);
    console.log(`incompleteTeam: ${incompleteTeam.teamId}`);
    console.log(`fatigueTeam: ${fatiguedTeam.teamId}`);

    const prismaAfter = await loadFoundationSnapshotFromPrisma("save-initial");
    const prismaAfterActivePlayers = prismaAfter?.activePlayers.length ?? null;
    const prismaAfterTeamStates = prismaAfter?.teamSeasonStates.length ?? null;
    if (prismaAfterActivePlayers !== prismaBeforeActivePlayers || prismaAfterTeamStates !== prismaBeforeTeamStates) {
      throw new Error("Resolve smoke detected unexpected Prisma changes.");
    }
  } finally {
    if (previousActiveSave?.saveId) {
      persistence.activateSave(previousActiveSave.saveId);
    }
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
