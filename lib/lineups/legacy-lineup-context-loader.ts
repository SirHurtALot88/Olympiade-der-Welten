import { createDefaultTeamStrategyProfile } from "@/lib/foundation/team-strategy-profiles";
import { LegacyLineupRepository } from "@/lib/lineups/legacy-lineup-repository";
import { buildLegacyLineupAggregateScore, scoreLegacyLineupDisciplineSide } from "@/lib/lineups/legacy-score-engine";
import { computeTeamDisciplineRanks } from "@/lib/lineups/team-discipline-ranks";
import type {
  LegacyLineupContextLoadResult,
  LegacyLineupEntryInput,
  LegacyLineupKeyParams,
  LegacyLineupLoadedContext,
  LegacyLineupPreviewResult,
} from "@/lib/lineups/legacy-lineup-types";
import { validateLegacyLineupContext } from "@/lib/lineups/legacy-lineup-validator";
import { db } from "@/src/server/db";

type DbClient = typeof db;

function deriveContextMeta(input: {
  seasonDisciplineConfigs: LegacyLineupLoadedContext["seasonDisciplineConfigs"];
  entries: LegacyLineupEntryInput[];
}) {
  const d1FromEntries = input.entries.find((entry) => entry.disciplineSide === "d1")?.disciplineId ?? null;
  const d2FromEntries = input.entries.find((entry) => entry.disciplineSide === "d2")?.disciplineId ?? null;

  if (d1FromEntries || d2FromEntries) {
    return {
      d1DisciplineId: d1FromEntries,
      d2DisciplineId: d2FromEntries,
    };
  }

  const orderedConfigs = [...input.seasonDisciplineConfigs].sort(
    (left, right) => (left.displayOrder ?? Number.MAX_SAFE_INTEGER) - (right.displayOrder ?? Number.MAX_SAFE_INTEGER),
  );

  return {
    d1DisciplineId: orderedConfigs[0]?.disciplineId ?? null,
    d2DisciplineId: orderedConfigs[1]?.disciplineId ?? null,
  };
}

export class LegacyLineupContextLoader {
  constructor(
    private readonly client: DbClient = db,
    private readonly repository: Pick<LegacyLineupRepository, "getLegacyLineupDraft"> = new LegacyLineupRepository(),
  ) {}

  async loadLegacyLineupContext(params: LegacyLineupKeyParams): Promise<LegacyLineupContextLoadResult> {
    const warnings: string[] = [];

    const [save, season, matchday, team, teamSeasonState, activePlayers, seasonDisciplineConfigs, draft] = await Promise.all([
      this.client.save.findUnique({ where: { id: params.saveId } }),
      this.client.season.findUnique({ where: { id: params.seasonId } }),
      this.client.matchday.findUnique({ where: { id: params.matchdayId } }),
      this.client.team.findUnique({ where: { id: params.teamId } }),
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
        orderBy: [{ createdAt: "asc" }],
      }),
      this.client.seasonDisciplineConfig.findMany({
        where: {
          seasonId: params.seasonId,
        },
        orderBy: [{ displayOrder: "asc" }],
      }),
      this.repository.getLegacyLineupDraft(params),
    ]);

    const errors: string[] = [];
    if (!save) errors.push(`Save ${params.saveId} could not be found.`);
    if (!season) errors.push(`Season ${params.seasonId} could not be found.`);
    if (!matchday) errors.push(`Matchday ${params.matchdayId} could not be found.`);
    if (!team) errors.push(`Team ${params.teamId} could not be found.`);
    if (!teamSeasonState) errors.push(`TeamSeasonState for save ${params.saveId}, season ${params.seasonId}, team ${params.teamId} could not be found.`);

    if (season && season.saveId !== params.saveId) {
      errors.push(`Season ${params.seasonId} does not belong to save ${params.saveId}.`);
    }

    if (matchday && matchday.seasonId !== params.seasonId) {
      errors.push(`Matchday ${params.matchdayId} does not belong to season ${params.seasonId}.`);
    }

    if (errors.length > 0 || !save || !season || !matchday || !team || !teamSeasonState) {
      return {
        ok: false,
        errors,
        warnings,
      };
    }

    const relevantDisciplineIds = Array.from(
      new Set([
        ...seasonDisciplineConfigs.map((config) => config.disciplineId),
        ...(draft?.entries.map((entry) => entry.disciplineId) ?? []),
      ]),
    );

    const activePlayerIds = activePlayers.map((player) => player.playerId);

    const [disciplines, disciplineScores, playerRows, playerAttributes, disciplineWeights, allActivePlayersForSeason, allTeamStates, allTeams] = await Promise.all([
      this.client.discipline.findMany({
        where: {
          id: {
            in: relevantDisciplineIds,
          },
        },
        orderBy: [{ name: "asc" }],
      }),
      relevantDisciplineIds.length === 0 || activePlayers.length === 0
        ? Promise.resolve([])
        : this.client.playerDisciplineScore.findMany({
            where: {
              disciplineId: {
                in: relevantDisciplineIds,
              },
              playerId: {
                in: activePlayers.map((player) => player.playerId),
              },
            },
            orderBy: [{ disciplineId: "asc" }, { playerId: "asc" }],
          }),
      activePlayerIds.length === 0
        ? Promise.resolve([])
        : this.client.player.findMany({
            where: {
              id: {
                in: activePlayerIds,
              },
            },
            select: {
              id: true,
              name: true,
              portraitUrl: true,
              portraitPath: true,
              className: true,
              race: true,
              traitsPositive: true,
              traitsNegative: true,
            },
            orderBy: [{ name: "asc" }],
          }),
      activePlayerIds.length === 0
        ? Promise.resolve([])
        : this.client.playerAttribute.findMany({
            select: {
              id: true,
              playerId: true,
              displayMarketValue: true,
              displaySalary: true,
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
            },
            where: {
              playerId: {
                in: activePlayerIds,
              },
            },
          }),
      relevantDisciplineIds.length === 0
        ? Promise.resolve([])
        : this.client.disciplineWeight.findMany({
            where: {
              disciplineId: {
                in: relevantDisciplineIds,
              },
              OR: [{ seasonId: params.seasonId }, { seasonId: null }],
            },
            orderBy: [{ disciplineId: "asc" }, { weightPct: "desc" }],
          }),
      this.client.activePlayer.findMany({
        where: {
          saveId: params.saveId,
          seasonId: params.seasonId,
        },
        orderBy: [{ teamId: "asc" }, { createdAt: "asc" }],
      }),
      this.client.teamSeasonState.findMany({
        where: {
          saveId: params.saveId,
          seasonId: params.seasonId,
        },
        orderBy: [{ teamId: "asc" }],
      }),
      typeof (this.client.team as { findMany?: unknown }).findMany === "function"
        ? this.client.team.findMany({
            orderBy: [{ id: "asc" }],
          })
        : Promise.resolve([]),
    ]);

    const attributeByPlayerId = new Map(playerAttributes.map((attribute) => [attribute.playerId, attribute]));
    const normalizeJsonStringArray = (value: unknown): string[] => (Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : []);
    const rosterPlayers = playerRows.map((player) => {
      const attributes = attributeByPlayerId.get(player.id);
      return {
        id: player.id,
        name: player.name,
        portraitUrl: player.portraitUrl ?? player.portraitPath ?? null,
        className: player.className ?? undefined,
        race: player.race ?? undefined,
        displayMarketValue: attributes?.displayMarketValue ?? null,
        displaySalary: attributes?.displaySalary ?? null,
        potential: null,
        ovr: null,
        pps: null,
        fatigue: null,
        form: null,
        traitsPositive: normalizeJsonStringArray(player.traitsPositive),
        traitsNegative: normalizeJsonStringArray(player.traitsNegative),
        attributeStats: {
          power: attributes?.power ?? null,
          health: attributes?.health ?? null,
          stamina: attributes?.stamina ?? null,
          intelligence: attributes?.intelligence ?? null,
          awareness: attributes?.awareness ?? null,
          determination: attributes?.determination ?? null,
          speed: attributes?.speed ?? null,
          dexterity: attributes?.dexterity ?? null,
          charisma: attributes?.charisma ?? null,
          will: attributes?.will ?? null,
          spirit: attributes?.spirit ?? null,
          torment: attributes?.torment ?? null,
        },
        attributeRatings: {
          power: attributes?.powerRating ?? null,
          health: attributes?.healthRating ?? null,
          stamina: attributes?.staminaRating ?? null,
          intelligence: attributes?.intelligenceRating ?? null,
          awareness: attributes?.awarenessRating ?? null,
          determination: attributes?.determinationRating ?? null,
          speed: attributes?.speedRating ?? null,
          dexterity: attributes?.dexterityRating ?? null,
          charisma: attributes?.charismaRating ?? null,
          will: attributes?.willRating ?? null,
          spirit: attributes?.spiritRating ?? null,
          torment: attributes?.tormentRating ?? null,
        },
        coreStats: {
          pow: attributes?.pow ?? 0,
          spe: attributes?.spe ?? 0,
          men: attributes?.men ?? 0,
          soc: attributes?.soc ?? 0,
        },
      };
    });
    const fullSeasonScoreRows =
      relevantDisciplineIds.length === 0 || allActivePlayersForSeason.length === 0
        ? []
        : await this.client.playerDisciplineScore.findMany({
            where: {
              disciplineId: {
                in: relevantDisciplineIds,
              },
              playerId: {
                in: Array.from(new Set(allActivePlayersForSeason.map((player) => player.playerId))),
              },
            },
            orderBy: [{ disciplineId: "asc" }, { playerId: "asc" }],
          });
    const scoreByPlayerAndDiscipline = new Map<string, number>();
    for (const score of fullSeasonScoreRows) {
      scoreByPlayerAndDiscipline.set(`${score.playerId}::${score.disciplineId}`, score.score);
    }
    const teamDisciplineRanks = computeTeamDisciplineRanks({
      teamId: params.teamId,
      teamIds: allTeamStates.map((entry) => entry.teamId),
      disciplineIds: relevantDisciplineIds,
      rosterAssignments: allActivePlayersForSeason.map((entry) => ({
        teamId: entry.teamId,
        playerId: entry.playerId,
      })),
      scoreByPlayerAndDiscipline,
    });

    if (!draft) {
      warnings.push("No existing legacy lineup draft was found for this save/season/matchday/team.");
    }

    const entries = draft?.entries ?? [];
    const meta = deriveContextMeta({
      seasonDisciplineConfigs: seasonDisciplineConfigs.map((config) => ({
        disciplineId: config.disciplineId,
        originalOrder: config.originalOrder,
        displayOrder: config.displayOrder,
        playerCount: config.playerCount,
        mutator1: config.mutator1,
        mutator2: config.mutator2,
      })),
      entries,
    });

    return {
      ok: true,
      warnings,
      context: {
        saveId: params.saveId,
        seasonId: params.seasonId,
        matchdayId: params.matchdayId,
        teamId: params.teamId,
        entries,
        disciplinePlayerCounts: Object.fromEntries(
          seasonDisciplineConfigs.map((config) => [config.disciplineId, config.playerCount ?? 0]),
        ),
        activePlayers: activePlayers.map((player) => ({
          id: player.id,
          saveId: player.saveId,
          seasonId: player.seasonId,
          teamId: player.teamId,
          playerId: player.playerId,
          contractLength: player.contractLength,
          salary: player.salary,
          upkeep: player.upkeep,
          marketValue: player.currentValue ?? player.purchasePrice ?? null,
        })),
        disciplineScores: disciplineScores.map((score) => ({
          playerId: score.playerId,
          disciplineId: score.disciplineId,
          score: score.score,
        })),
        save: {
          id: save.id,
          name: save.name,
          status: save.status,
        },
        season: {
          id: season.id,
          saveId: season.saveId,
          name: season.name,
          year: season.year,
          currentMatchday: season.currentMatchday,
          status: season.status,
        },
        matchday: {
          id: matchday.id,
          seasonId: matchday.seasonId,
          index: matchday.index,
          label: matchday.label,
          status: matchday.status,
        },
        team: {
          id: team.id,
          shortCode: team.shortCode,
          name: team.name,
          logoPath: team.logoPath ?? null,
        },
        teamSeasonState: {
          id: teamSeasonState.id,
          saveId: teamSeasonState.saveId,
          seasonId: teamSeasonState.seasonId,
          teamId: teamSeasonState.teamId,
          cash: teamSeasonState.cash,
          budget: teamSeasonState.budget,
          rosterLimit: teamSeasonState.rosterLimit,
          playerOpt: teamSeasonState.playerOpt,
        },
        teamIdentity: {
          pow: teamSeasonState.pow,
          spe: teamSeasonState.spe,
          men: teamSeasonState.men,
          soc: teamSeasonState.soc,
        },
        teamStrategyProfile: createDefaultTeamStrategyProfile(
          {
            teamId: team.id,
            shortCode: team.shortCode,
            name: team.name,
            logoPath: null,
            budget: teamSeasonState.budget,
            cash: teamSeasonState.cash,
            identityId: team.id,
            humanControlled: false,
            rosterLimit: teamSeasonState.rosterLimit,
          },
          {
            teamId: team.id,
            pow: teamSeasonState.pow,
            spe: teamSeasonState.spe,
            men: teamSeasonState.men,
            soc: teamSeasonState.soc,
            ambition: 50,
            finances: 50,
            boardConfidence: 50,
            harmony: 50,
            manners: 50,
            popularity: 50,
            cooperation: 50,
            playerMin: 0,
            playerOpt: teamSeasonState.playerOpt ?? 0,
          },
        ),
        allTeamIdentities: allTeamStates.map((state) => {
          const mappedTeam = allTeams.find((entry) => entry.id === state.teamId);
          return {
            teamId: state.teamId,
            teamCode: mappedTeam?.shortCode ?? state.teamId,
            teamName: mappedTeam?.name ?? state.teamId,
            pow: state.pow,
            spe: state.spe,
            men: state.men,
            soc: state.soc,
          };
        }),
        rosterPlayers,
        disciplines: disciplines.map((discipline) => ({
          id: discipline.id,
          name: discipline.name,
          category: discipline.category,
        })),
        disciplineWeights: disciplineWeights.map((weight) => ({
          disciplineId: weight.disciplineId,
          attributeKey: weight.attributeKey,
          weightPct: weight.weightPct,
        })),
        seasonDisciplineConfigs: seasonDisciplineConfigs.map((config) => ({
          disciplineId: config.disciplineId,
          originalOrder: config.originalOrder,
          displayOrder: config.displayOrder,
          playerCount: config.playerCount,
          mutator1: config.mutator1,
          mutator2: config.mutator2,
        })),
        existingDraft: draft,
        contextMeta: {
          ...params,
          ...meta,
        },
        fatigueByPlayerId: null,
        fatigueSourceStatus: "missing_source",
        teamDisciplineRanks,
      },
    };
  }
}

export async function loadLegacyLineupContext(params: LegacyLineupKeyParams) {
  const loader = new LegacyLineupContextLoader();
  return loader.loadLegacyLineupContext(params);
}

export async function buildLegacyLineupPreview(
  params: LegacyLineupKeyParams,
  entries: LegacyLineupEntryInput[],
  options?: {
    loader?: Pick<LegacyLineupContextLoader, "loadLegacyLineupContext">;
  },
): Promise<LegacyLineupPreviewResult> {
  const contextResult = options?.loader
    ? await options.loader.loadLegacyLineupContext(params)
    : await loadLegacyLineupContext(params);
  if (!contextResult.ok) {
    return contextResult;
  }

  const relevantDisciplineIds = Array.from(new Set(entries.map((entry) => entry.disciplineId)));
  const validation = validateLegacyLineupContext({
    ...contextResult.context,
    entries,
    disciplinePlayerCounts:
      relevantDisciplineIds.length > 0
        ? Object.fromEntries(
            Object.entries(contextResult.context.disciplinePlayerCounts).filter(([disciplineId]) =>
              relevantDisciplineIds.includes(disciplineId),
            ),
          )
        : {},
    disciplineSidePlayerCounts: Object.fromEntries(
      Array.from(new Set(entries.map((entry) => `${entry.disciplineId}::${entry.disciplineSide}`))).map((key) => {
        const [disciplineId] = key.split("::");
        return [key, contextResult.context.disciplinePlayerCounts[disciplineId] ?? 0] as const;
      }),
    ),
  });

  const previewPairs = [
    contextResult.context.matchdayContract?.discipline1
      ? `${contextResult.context.matchdayContract.discipline1.disciplineId}::${contextResult.context.matchdayContract.discipline1.disciplineSide}`
      : null,
    contextResult.context.matchdayContract?.discipline2
      ? `${contextResult.context.matchdayContract.discipline2.disciplineId}::${contextResult.context.matchdayContract.discipline2.disciplineSide}`
      : null,
    ...entries.map((entry) => `${entry.disciplineId}::${entry.disciplineSide}`),
  ].filter((value): value is string => Boolean(value));
  const uniquePairs = Array.from(new Set(previewPairs));
  const scoreParts = uniquePairs.map((pair) => {
    const [disciplineId, disciplineSide] = pair.split("::") as [string, "d1" | "d2"];
    return scoreLegacyLineupDisciplineSide({
      disciplineId,
      disciplineSide,
      entries,
      disciplineScores: contextResult.context.disciplineScores,
      activePlayers: contextResult.context.activePlayers,
      rosterPlayers: contextResult.context.rosterPlayers,
      requiredPlayers:
        contextResult.context.disciplineSidePlayerCounts?.[pair] ??
        contextResult.context.disciplinePlayerCounts[disciplineId] ??
        null,
      fatigueByPlayerId: null,
      fatigueSourceStatus: "missing_source",
      formCardsAvailable: null,
      formCardsSelected: null,
      formModifier: null,
      mutatorText: null,
      mutatorModifier: null,
    });
  });
  const scorePreview = buildLegacyLineupAggregateScore(scoreParts);

  return {
    ok: true,
    contextMeta: contextResult.context.contextMeta,
    validation,
    disciplineSideScores: scoreParts,
    scorePreview: {
      ...scorePreview,
      validationWarnings: [...contextResult.warnings, ...validation.warnings, ...scorePreview.validationWarnings],
    },
    warnings: contextResult.warnings,
  };
}
