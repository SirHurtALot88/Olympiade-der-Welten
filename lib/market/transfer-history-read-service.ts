import { db } from "@/src/server/db";

export type TransferHistoryReadParams = {
  saveId?: string | null;
  seasonId?: string | null;
  teamId?: string | null;
  type?: "buy" | "sell" | "contract_exit" | null;
  limit?: number | null;
};

export type TransferHistoryItem = {
  transferId: string;
  type: "buy" | "sell" | "contract_exit";
  playerId: string;
  playerName: string;
  fromTeamId: string | null;
  fromTeamName: string | null;
  toTeamId: string | null;
  toTeamName: string | null;
  fee: number;
  salary: number;
  marketValue: number;
  happenedAt: string;
  saveId: string;
  seasonId: string;
  seasonLabel: string;
  matchdayId: string | null;
  phase: string | null;
  source: string | null;
  remainingContractLength: number | null;
};

export type TransferHistoryReadResult = {
  items: TransferHistoryItem[];
  total: number;
  scope: {
    saveId: string;
    seasonId: string;
    teamId: string | null;
    type: "buy" | "sell" | "contract_exit" | null;
  };
  saveContext: {
    source: "prisma" | "sqlite";
    requestedSaveId: string | null;
    resolvedSaveId: string | null;
    requestedSeasonId: string | null;
    resolvedSeasonId: string | null;
    saveName: string | null;
    saveStatus: string | null;
    scopeWarning: string | null;
  };
};

type DatabaseLike = {
  save: {
    findUnique(args: unknown): Promise<{ id: string; name?: string | null; status?: string | null } | null>;
    findFirst(args: unknown): Promise<{ id: string; name?: string | null; status?: string | null } | null>;
  };
  season: {
    findFirst(args: unknown): Promise<{ id: string; saveId: string } | null>;
  };
  transfer: {
    findMany(args: unknown): Promise<Array<{
      id: string;
      saveId: string;
      seasonId: string;
      playerId: string;
      fromTeamId: string | null;
      toTeamId: string | null;
      type: "buy" | "sell";
      fee: number;
      salary: number;
      marketValue: number;
      remainingContractLength: number | null;
      happenedAt: Date;
      player: {
        id: string;
        name: string;
      };
      fromTeam: {
        id: string;
        name: string;
      } | null;
      toTeam: {
        id: string;
        name: string;
      } | null;
    }>>;
  };
};

async function resolveScope(database: DatabaseLike, input: TransferHistoryReadParams) {
  const requestedSaveId = input.saveId ?? null;
  const requestedSeasonId = input.seasonId ?? null;
  const explicitlyRequestedSave =
    requestedSaveId != null ? await database.save.findUnique({ where: { id: requestedSaveId } }) : null;

  if (requestedSaveId && !explicitlyRequestedSave) {
    return {
      saveId: null,
      seasonId: null,
      saveName: null,
      saveStatus: null,
      requestedSaveId,
      requestedSeasonId,
      scopeWarning: `Requested save ${requestedSaveId} could not be resolved for transfer history.`,
    };
  }

  const save =
    explicitlyRequestedSave ??
    (await database.save.findFirst({ where: { status: "active" }, orderBy: [{ updatedAt: "desc" }] })) ??
    (await database.save.findFirst({ orderBy: [{ updatedAt: "desc" }] }));

  if (!save) {
    throw new Error("No save available for transfer history read.");
  }

  if (requestedSeasonId) {
    const requestedSeason = await database.season.findFirst({ where: { id: requestedSeasonId, saveId: save.id } });
    if (!requestedSeason) {
      return {
        saveId: save.id,
        seasonId: null,
        saveName: save.name ?? null,
        saveStatus: save.status ?? null,
        requestedSaveId,
        requestedSeasonId,
        scopeWarning: `Requested season ${requestedSeasonId} is not available in save ${save.id}.`,
      };
    }

    return {
      saveId: save.id,
      seasonId: requestedSeason.id,
      saveName: save.name ?? null,
      saveStatus: save.status ?? null,
      requestedSaveId,
      requestedSeasonId,
      scopeWarning: null,
    };
  }

  const season =
    (await database.season.findFirst({ where: { id: "season-1", saveId: save.id } })) ??
    (await database.season.findFirst({ where: { saveId: save.id }, orderBy: [{ year: "asc" }] }));

  if (!season) {
    throw new Error(`No season available for save ${save.id}.`);
  }

  return {
    saveId: save.id,
    seasonId: season.id,
    saveName: save.name ?? null,
    saveStatus: save.status ?? null,
    requestedSaveId,
    requestedSeasonId,
    scopeWarning: null,
  };
}

export async function listTransferHistory(
  input: TransferHistoryReadParams = {},
  database: DatabaseLike = db as unknown as DatabaseLike,
): Promise<TransferHistoryReadResult> {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is missing. Transfer history read requires a configured Prisma database.");
  }

  const scope = await resolveScope(database, input);
  if (!scope.saveId || !scope.seasonId) {
    return {
      items: [],
      total: 0,
      scope: {
        saveId: scope.saveId ?? input.saveId ?? "unknown-save",
        seasonId: scope.seasonId ?? input.seasonId ?? "unknown-season",
        teamId: input.teamId ?? null,
        type: input.type ?? null,
      },
      saveContext: {
        source: "prisma",
        requestedSaveId: scope.requestedSaveId,
        resolvedSaveId: scope.saveId,
        requestedSeasonId: scope.requestedSeasonId,
        resolvedSeasonId: scope.seasonId,
        saveName: scope.saveName,
        saveStatus: scope.saveStatus,
        scopeWarning: scope.scopeWarning,
      },
    };
  }
  const limit = input.limit != null ? Math.max(1, Math.min(input.limit, 250)) : 100;

  const rows = await database.transfer.findMany({
    where: {
      saveId: scope.saveId,
      seasonId: scope.seasonId,
      ...(input.teamId
        ? {
            OR: [{ fromTeamId: input.teamId }, { toTeamId: input.teamId }],
          }
        : {}),
      ...(input.type ? { type: input.type } : {}),
    },
    select: {
      id: true,
      saveId: true,
      seasonId: true,
      playerId: true,
      fromTeamId: true,
      toTeamId: true,
      type: true,
      fee: true,
      salary: true,
      marketValue: true,
      remainingContractLength: true,
      happenedAt: true,
      player: {
        select: {
          id: true,
          name: true,
        },
      },
      fromTeam: {
        select: {
          id: true,
          name: true,
        },
      },
      toTeam: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: [{ happenedAt: "desc" }, { id: "desc" }],
    take: limit,
  });

  return {
    items: rows.map((row) => ({
      transferId: row.id,
      type: row.type,
      playerId: row.playerId,
      playerName: row.player.name,
      fromTeamId: row.fromTeamId,
      fromTeamName: row.fromTeam?.name ?? null,
      toTeamId: row.toTeamId,
      toTeamName: row.toTeam?.name ?? null,
      fee: row.fee,
      salary: row.salary,
      marketValue: row.marketValue,
      happenedAt: row.happenedAt.toISOString(),
      saveId: row.saveId,
      seasonId: row.seasonId,
      seasonLabel: row.seasonId,
      matchdayId: null,
      phase: null,
      source: null,
      remainingContractLength: row.remainingContractLength ?? null,
    })),
    total: rows.length,
    scope: {
      saveId: scope.saveId,
      seasonId: scope.seasonId,
      teamId: input.teamId ?? null,
      type: input.type ?? null,
    },
    saveContext: {
      source: "prisma",
      requestedSaveId: scope.requestedSaveId,
      resolvedSaveId: scope.saveId,
      requestedSeasonId: scope.requestedSeasonId,
      resolvedSeasonId: scope.seasonId,
      saveName: scope.saveName,
      saveStatus: scope.saveStatus,
      scopeWarning: scope.scopeWarning,
    },
  };
}
