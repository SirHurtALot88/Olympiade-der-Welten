import type { Prisma } from "@prisma/client";

import { db } from "@/src/server/db";

type SaveRecord = Prisma.SaveGetPayload<Record<string, never>>;
type SeasonRecord = Prisma.SeasonGetPayload<Record<string, never>>;
type TeamSeasonStateRecord = Prisma.TeamSeasonStateGetPayload<{
  include: {
    team: true;
  };
}>;
type PlayerAttributeRecord = Prisma.PlayerAttributeGetPayload<Record<string, never>>;
type PlayerDisciplineScoreRecord = Prisma.PlayerDisciplineScoreGetPayload<Record<string, never>>;
type PlayerBaseRecord = {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  portraitPath: string | null;
  portraitUrl: string | null;
  className: string;
  race: string;
  alignment: string;
  gender: string;
  referenceClass: string | null;
  imageSource: string | null;
  bracketLabel: string | null;
  flavorEn: string;
  flavorDe: string;
  subclasses: Prisma.JsonValue;
  traitsPositive: Prisma.JsonValue;
  traitsNegative: Prisma.JsonValue;
  preferredDisciplineIds: Prisma.JsonValue;
};
type PlayerRecord = PlayerBaseRecord & {
  attributes: PlayerAttributeRecord | null;
  disciplineScores: PlayerDisciplineScoreRecord[];
};
type DisciplineRecord = Prisma.DisciplineGetPayload<{
  include: {
    seasonConfigs: true;
    weights: true;
  };
}>;
type MatchdayRecord = Prisma.MatchdayGetPayload<Record<string, never>>;
type ActivePlayerRecord = Prisma.ActivePlayerGetPayload<Record<string, never>>;

export type PrismaFoundationReadSnapshot = {
  save: SaveRecord;
  saves: SaveRecord[];
  season: SeasonRecord;
  teamSeasonStates: TeamSeasonStateRecord[];
  players: PlayerRecord[];
  disciplines: DisciplineRecord[];
  matchdays: MatchdayRecord[];
  activePlayers: ActivePlayerRecord[];
};

async function getTargetSave(requestedSaveId?: string) {
  if (requestedSaveId) {
    return db.save.findUnique({
      where: { id: requestedSaveId },
    });
  }

  return (
    (await db.save.findFirst({
      where: { status: "active" },
      orderBy: [{ updatedAt: "desc" }],
    })) ??
    db.save.findFirst({
      orderBy: [{ updatedAt: "desc" }],
    })
  );
}

async function getTargetSeason(saveId: string) {
  return (
    (await db.season.findFirst({
      where: { saveId, status: "active" },
      orderBy: [{ year: "asc" }],
    })) ??
    db.season.findFirst({
      where: { saveId },
      orderBy: [{ year: "asc" }],
    })
  );
}

export async function loadFoundationSnapshotFromPrisma(
  requestedSaveId?: string,
): Promise<PrismaFoundationReadSnapshot | null> {
  if (!process.env.DATABASE_URL) {
    return null;
  }

  try {
    const save = await getTargetSave(requestedSaveId);
    if (!save) {
      return null;
    }

    const season = await getTargetSeason(save.id);
    if (!season) {
      return null;
    }

    const saves = await db.save.findMany({
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    });
    const teamSeasonStates = await db.teamSeasonState.findMany({
      where: {
        saveId: save.id,
        seasonId: season.id,
      },
      include: {
        team: true,
      },
      orderBy: [{ teamId: "asc" }],
    });
    const playerBaseRows = await db.player.findMany({
      select: {
        id: true,
        name: true,
        createdAt: true,
        updatedAt: true,
        portraitPath: true,
        portraitUrl: true,
        className: true,
        race: true,
        alignment: true,
        gender: true,
        referenceClass: true,
        imageSource: true,
        bracketLabel: true,
        flavorEn: true,
        flavorDe: true,
        subclasses: true,
        traitsPositive: true,
        traitsNegative: true,
        preferredDisciplineIds: true,
      },
      orderBy: [{ name: "asc" }],
    });
    const playerIds = playerBaseRows.map((player) => player.id);
    const playerAttributes = playerIds.length
      ? await db.playerAttribute.findMany({
          select: {
            id: true,
            playerId: true,
            createdAt: true,
            updatedAt: true,
            rating: true,
            marketValue: true,
            salaryDemand: true,
            displayMarketValue: true,
            displaySalary: true,
            cost: true,
            upkeepBase: true,
            pow: true,
            spe: true,
            men: true,
            soc: true,
            power: true,
            health: true,
            stamina: true,
            intelligence: true,
            awareness: true,
            determination: true,
            speed: true,
            dexterity: true,
            charisma: true,
            will: true,
            spirit: true,
            torment: true,
            powerRating: true,
            healthRating: true,
            staminaRating: true,
            intelligenceRating: true,
            awarenessRating: true,
            determinationRating: true,
            speedRating: true,
            dexterityRating: true,
            charismaRating: true,
            willRating: true,
            spiritRating: true,
            tormentRating: true,
            fatigue: true,
            form: true,
            potential: true,
            above20: true,
            above40: true,
            above60: true,
            above80: true,
          },
          where: {
            playerId: {
              in: playerIds,
            },
          },
        })
      : [];
    const playerDisciplineScores = playerIds.length
      ? await db.playerDisciplineScore.findMany({
          where: {
            playerId: {
              in: playerIds,
            },
          },
          orderBy: [{ disciplineId: "asc" }],
        })
      : [];
    const attributesByPlayerId = new Map(playerAttributes.map((attribute) => [attribute.playerId, attribute]));
    const scoresByPlayerId = new Map<string, PlayerDisciplineScoreRecord[]>();

    for (const score of playerDisciplineScores) {
      const current = scoresByPlayerId.get(score.playerId);
      if (current) {
        current.push(score);
      } else {
        scoresByPlayerId.set(score.playerId, [score]);
      }
    }

    const players: PlayerRecord[] = playerBaseRows.map((player) => ({
      ...player,
      attributes: attributesByPlayerId.get(player.id) ?? null,
      disciplineScores: scoresByPlayerId.get(player.id) ?? [],
    }));
    const disciplines = await db.discipline.findMany({
      include: {
        seasonConfigs: {
          where: {
            seasonId: season.id,
          },
        },
        weights: {
          where: {
            OR: [{ seasonId: season.id }, { seasonId: null }],
          },
          orderBy: [{ attributeKey: "asc" }],
        },
      },
      orderBy: [{ name: "asc" }],
    });
    const matchdays = await db.matchday.findMany({
      where: {
        seasonId: season.id,
      },
      orderBy: [{ index: "asc" }],
    });
    const activePlayers = await db.activePlayer.findMany({
      where: {
        saveId: save.id,
        seasonId: season.id,
      },
      orderBy: [{ createdAt: "asc" }],
    });

    return {
      save,
      saves,
      season,
      teamSeasonStates,
      players,
      disciplines,
      matchdays,
      activePlayers,
    };
  } catch (error) {
    console.warn("Prisma foundation read failed, falling back to SQLite snapshot.", error);
    return null;
  }
}
