import type { Prisma } from "@prisma/client";

import type {
  LegacyLineupDraft,
  LegacyLineupEntryInput,
  LegacyLineupKeyParams,
  LegacyLineupRepositoryContext,
} from "@/lib/lineups/legacy-lineup-types";
import { createDefaultLineupDraftModifiers } from "@/lib/lineups/legacy-lineup-modifiers";
import { db } from "@/src/server/db";

function createLineupId(input: LegacyLineupKeyParams) {
  return `legacy-lineup:${input.saveId}:${input.seasonId}:${input.matchdayId}:${input.teamId}`;
}

function createLineupSlotId(lineupId: string, entry: LegacyLineupEntryInput) {
  return `${lineupId}:${entry.disciplineId}:${entry.disciplineSide}:${entry.slotIndex}`;
}

function toDraft(
  lineup: Prisma.LineupGetPayload<{
    include: {
      slots: true;
    };
  }>,
): LegacyLineupDraft {
  return {
    lineupId: lineup.id,
    saveId: lineup.saveId,
    seasonId: lineup.seasonId,
    matchdayId: lineup.matchdayId,
    teamId: lineup.teamId,
    status: lineup.status,
    entries: lineup.slots
      .map((slot) => ({
        disciplineId: slot.disciplineId,
        disciplineSide: slot.disciplineSide,
        slotIndex: slot.slotIndex,
        playerId: slot.playerId ?? "",
        activePlayerId: slot.activePlayerId,
      }))
      .sort((left, right) => {
        if (left.disciplineId !== right.disciplineId) {
          return left.disciplineId.localeCompare(right.disciplineId);
        }
        if (left.disciplineSide !== right.disciplineSide) {
          return left.disciplineSide.localeCompare(right.disciplineSide);
        }
        return left.slotIndex - right.slotIndex;
      }),
    modifiers: createDefaultLineupDraftModifiers(),
    createdAt: lineup.createdAt.toISOString(),
    updatedAt: lineup.updatedAt.toISOString(),
  };
}

export class LegacyLineupRepository {
  constructor(private readonly client: typeof db = db) {}

  async getLegacyLineupDraft(params: LegacyLineupKeyParams): Promise<LegacyLineupDraft | null> {
    const lineup = await this.client.lineup.findUnique({
      where: {
        saveId_seasonId_matchdayId_teamId: {
          saveId: params.saveId,
          seasonId: params.seasonId,
          matchdayId: params.matchdayId,
          teamId: params.teamId,
        },
      },
      include: {
        slots: {
          orderBy: [{ disciplineId: "asc" }, { disciplineSide: "asc" }, { slotIndex: "asc" }],
        },
      },
    });

    return lineup ? toDraft(lineup) : null;
  }

  async getLegacyLineupRepositoryContext(
    params: LegacyLineupKeyParams,
    entries: LegacyLineupEntryInput[],
  ): Promise<LegacyLineupRepositoryContext | null> {
    const [save, season, matchday, teamState, activePlayers, disciplineConfigs] = await Promise.all([
      this.client.save.findUnique({ where: { id: params.saveId } }),
      this.client.season.findUnique({ where: { id: params.seasonId } }),
      this.client.matchday.findUnique({ where: { id: params.matchdayId } }),
      this.client.teamSeasonState.findUnique({
        where: {
          saveId_seasonId_teamId: {
            saveId: params.saveId,
            seasonId: params.seasonId,
            teamId: params.teamId,
          },
        },
      }),
      this.client.activePlayer.findMany({
        where: {
          saveId: params.saveId,
          seasonId: params.seasonId,
          teamId: params.teamId,
        },
      }),
      this.client.seasonDisciplineConfig.findMany({
        where: {
          seasonId: params.seasonId,
        },
      }),
    ]);

    if (!save || !season || !matchday || !teamState) {
      return null;
    }

    if (season.saveId !== params.saveId || matchday.seasonId !== params.seasonId) {
      return null;
    }

    const relevantDisciplineIds = Array.from(new Set(entries.map((entry) => entry.disciplineId)));
    const disciplineScores = relevantDisciplineIds.length
      ? await this.client.playerDisciplineScore.findMany({
          where: {
            disciplineId: {
              in: relevantDisciplineIds,
            },
            playerId: {
              in: activePlayers.map((player) => player.playerId),
            },
          },
        })
      : [];

    return {
      ...params,
      entries,
      disciplinePlayerCounts: Object.fromEntries(
        disciplineConfigs
          .filter((config) => relevantDisciplineIds.length === 0 || relevantDisciplineIds.includes(config.disciplineId))
          .map((config) => [config.disciplineId, config.playerCount ?? 0]),
      ),
      activePlayers: activePlayers.map((player) => ({
        id: player.id,
        saveId: player.saveId,
        seasonId: player.seasonId,
        teamId: player.teamId,
        playerId: player.playerId,
      })),
      disciplineScores: disciplineScores.map((score) => ({
        playerId: score.playerId,
        disciplineId: score.disciplineId,
        score: score.score,
      })),
    };
  }

  async saveLegacyLineupDraft(
    params: LegacyLineupKeyParams,
    entries: LegacyLineupEntryInput[],
  ): Promise<LegacyLineupDraft> {
    return this.client.$transaction(async (tx) => {
      const existing = await tx.lineup.findUnique({
        where: {
          saveId_seasonId_matchdayId_teamId: {
            saveId: params.saveId,
            seasonId: params.seasonId,
            matchdayId: params.matchdayId,
            teamId: params.teamId,
          },
        },
        include: {
          slots: true,
        },
      });

      if (existing && existing.status !== "draft") {
        throw new Error(`Lineup ${existing.id} is ${existing.status} and cannot be overwritten as draft.`);
      }

      const lineup =
        existing ??
        (await tx.lineup.create({
          data: {
            id: createLineupId(params),
            saveId: params.saveId,
            seasonId: params.seasonId,
            matchdayId: params.matchdayId,
            teamId: params.teamId,
            status: "draft",
          },
          include: {
            slots: true,
          },
        }));

      await tx.lineupSlot.deleteMany({
        where: {
          lineupId: lineup.id,
        },
      });

      if (entries.length > 0) {
        await tx.lineupSlot.createMany({
          data: entries.map((entry) => ({
            id: createLineupSlotId(lineup.id, entry),
            lineupId: lineup.id,
            disciplineId: entry.disciplineId,
            disciplineSide: entry.disciplineSide,
            slotIndex: entry.slotIndex,
            playerId: entry.playerId,
            activePlayerId: entry.activePlayerId,
          })),
        });
      }

      const saved = await tx.lineup.update({
        where: {
          id: lineup.id,
        },
        data: {
          status: "draft",
        },
        include: {
          slots: {
            orderBy: [{ disciplineId: "asc" }, { disciplineSide: "asc" }, { slotIndex: "asc" }],
          },
        },
      });

      return toDraft(saved);
    });
  }
}
