import type {
  TransferAffordabilityStatus,
  TransferRosterPressureStatus,
} from "@/lib/market/types";
import { getPlayerPortraitBrowserUrl } from "@/lib/data/mediaAssets";
import {
  calculateTransfermarktFit,
  getTransfermarktBracket,
  hasMercenaryTrait,
  toStringArray,
} from "@/lib/market/transfermarkt-fit";
import {
  getTransfermarktTierFromPoints,
  loadTransfermarktSheetStats,
  type TransfermarktRatingTier,
} from "@/lib/market/transfermarkt-sheet-stats";
import { buildLegacyMatchdayReadiness, type LegacyMatchdayReadinessStatus } from "@/lib/lineups/legacy-matchday-readiness";
import { LegacyLineupContextLoader } from "@/lib/lineups/legacy-lineup-context-loader";
import { LegacyLineupRepository } from "@/lib/lineups/legacy-lineup-repository";
import { buildPlayerRatingContractRows } from "@/lib/foundation/player-rating-contract";
import { buildTransfermarktPoolAudit, type TransfermarktPoolAudit } from "@/lib/market/transfermarkt-pool-audit";
import type { Player } from "@/lib/data/olyDataTypes";
import { db } from "@/src/server/db";

export type TransfermarktAvailabilityReason = "free_agent" | "no_active_player";
export type TransfermarktSalaryStatus = "known" | "missing";

export type TransfermarktDisciplineScore = {
  disciplineId: string;
  disciplineName: string;
  scoreTier: TransfermarktRatingTier | null;
  ppsLastSeason: number | null;
};

export type TransfermarktFreeAgentItem = {
  playerId: string;
  name: string;
  className: string;
  race: string;
  alignment: string;
  gender: string;
  subclasses: string[];
  traitsPositive: string[];
  traitsNegative: string[];
  preferredDisciplineIds: string[];
  subclass1: string | null;
  subclass2: string | null;
  subclass3: string | null;
  traitPos1: string | null;
  traitPos2: string | null;
  traitPos3: string | null;
  traitNeg1: string | null;
  traitNeg2: string | null;
  traitNeg3: string | null;
  marketValue: number | null;
  ovr: number | null;
  mvs: number | null;
  salary: number | null;
  marketValueSalaryRatio: number | null;
  bracket: number | null;
  salaryStatus: TransfermarktSalaryStatus;
  pow: number | null;
  spe: number | null;
  men: number | null;
  soc: number | null;
  powTier: TransfermarktRatingTier | null;
  speTier: TransfermarktRatingTier | null;
  menTier: TransfermarktRatingTier | null;
  socTier: TransfermarktRatingTier | null;
  above20: number | null;
  above40: number | null;
  above60: number | null;
  above80: number | null;
  powerRating: TransfermarktRatingTier | null;
  healthRating: TransfermarktRatingTier | null;
  staminaRating: TransfermarktRatingTier | null;
  intelligenceRating: TransfermarktRatingTier | null;
  determinationRating: TransfermarktRatingTier | null;
  awarenessRating: TransfermarktRatingTier | null;
  speedRating: TransfermarktRatingTier | null;
  dexterityRating: TransfermarktRatingTier | null;
  charismaRating: TransfermarktRatingTier | null;
  willRating: TransfermarktRatingTier | null;
  spiritRating: TransfermarktRatingTier | null;
  tormentRating: TransfermarktRatingTier | null;
  topDisciplineScores: TransfermarktDisciplineScore[];
  portraitPath: string | null;
  portraitUrl: string | null;
  imageUrl: string | null;
  availabilityReason: TransfermarktAvailabilityReason;
  teamContextAvailable: boolean;
  teamCash: number | null;
  teamSalary: number | null;
  rosterCount: number | null;
  playerMin: number | null;
  playerOpt: number | null;
  readinessStatus: LegacyMatchdayReadinessStatus | "unknown" | null;
  affordabilityStatus: TransferAffordabilityStatus | null;
  rosterPressureStatus: TransferRosterPressureStatus | null;
  fitRace: number | null;
  fitSubclasses: number | null;
  fitTraits: number | null;
  fitAlignment: number | null;
  mercenary: boolean;
  fit: number | null;
  fitDisplay: string;
  fitSource: "select_team_for_fit" | "not_ported_golden_master" | "local_approximation_not_golden_master";
  missingFields?: string[];
};

export type TransfermarktReadParams = {
  saveId?: string | null;
  seasonId?: string | null;
  teamId?: string | null;
  limit?: number | null;
  search?: string | null;
  minMarketValue?: number | null;
  maxMarketValue?: number | null;
};

export type TransfermarktReadResult = {
  items: TransfermarktFreeAgentItem[];
  total: number;
  scope: {
    saveId: string;
    seasonId: string;
    teamId: string | null;
  };
  teamContext: {
    teamId: string;
    teamCash: number;
    teamSalary: number;
    rosterCount: number;
    playerMin: number;
    playerOpt: number;
    readinessStatus: LegacyMatchdayReadinessStatus | "unknown";
    affordabilityStatus: TransferAffordabilityStatus;
    rosterPressureStatus: TransferRosterPressureStatus;
  } | null;
  source: "derived_free_agents";
  notes: string[];
  warnings: string[];
  poolAudit: TransfermarktPoolAudit;
};

type DatabaseLike = {
  save: {
    findUnique(args: unknown): Promise<{ id: string } | null>;
    findFirst(args: unknown): Promise<{ id: string } | null>;
  };
  season: {
    findFirst(args: unknown): Promise<{ id: string; saveId: string } | null>;
  };
  player: {
    findMany(args: unknown): Promise<
      Array<{
        id: string;
        name: string;
        portraitPath: string | null;
        portraitUrl: string | null;
        className: string;
        race: string;
        alignment: string;
        gender: string;
        referenceClass?: string | null;
        imageSource?: string | null;
        bracketLabel?: string | null;
        subclasses: unknown;
        traitsPositive: unknown;
        traitsNegative: unknown;
        preferredDisciplineIds: unknown;
        attributes: {
          marketValue: number;
          salaryDemand: number;
          rating: number;
          displayMarketValue?: number;
          displaySalary?: number;
          cost?: number;
          upkeepBase?: number;
          pow: number;
          spe: number;
          men: number;
          soc: number;
          above20: number;
          above40: number;
          above60: number;
          above80: number;
        } | null;
        disciplineScores: Array<{
          score: number;
          discipline: {
            id: string;
            name: string;
          };
        }>;
      }>
    >;
  };
  activePlayer: {
    findMany(args: unknown): Promise<Array<{
      playerId: string;
      teamId?: string;
      salary?: number;
      player?: {
        race: string;
        alignment: string;
        subclasses: unknown;
        traitsPositive: unknown;
        traitsNegative: unknown;
      } | null;
    }>>;
  };
  matchday?: {
    findFirst(args: unknown): Promise<{ id: string } | null>;
  };
  teamSeasonState?: {
    findFirst(args: unknown): Promise<{
      teamId: string;
      cash: number;
      playerMin: number;
      playerOpt: number;
      rosterLimit: number;
    } | null>;
  };
};

function normalizeSearch(value: string) {
  return value.trim().toLocaleLowerCase("de");
}

function getDisplayedMarketValue(
  player: {
    attributes: {
      marketValue: number;
      displayMarketValue?: number;
    } | null;
  },
  sheetStats?: {
    displayMarketValue: number | null;
  } | null,
) {
  return sheetStats?.displayMarketValue ?? player.attributes?.displayMarketValue ?? player.attributes?.marketValue ?? null;
}

function getDisplayedSalary(
  player: {
    attributes: {
      salaryDemand: number;
      displaySalary?: number;
    } | null;
  },
  sheetStats?: {
    displaySalary: number | null;
  } | null,
) {
  return sheetStats?.displaySalary ?? player.attributes?.displaySalary ?? player.attributes?.salaryDemand ?? null;
}

function getPlayerCost(
  player: {
    attributes: {
      marketValue: number;
      cost?: number;
    } | null;
  },
  sheetStats?: {
    cost: number | null;
  } | null,
) {
  return sheetStats?.cost ?? player.attributes?.cost ?? player.attributes?.marketValue ?? null;
}

function getArraySlots(values: string[]) {
  return {
    first: values[0] ?? null,
    second: values[1] ?? null,
    third: values[2] ?? null,
  };
}

export async function resolveTransfermarktScope(
  database: DatabaseLike,
  input: Pick<TransfermarktReadParams, "saveId" | "seasonId">,
) {
  const save =
    (input.saveId ? await database.save.findUnique({ where: { id: input.saveId } }) : null) ??
    (await database.save.findFirst({ where: { status: "active" }, orderBy: [{ updatedAt: "desc" }] })) ??
    (await database.save.findFirst({ orderBy: [{ updatedAt: "desc" }] }));

  if (!save) {
    throw new Error("No save available for transfermarkt read.");
  }

  const season =
    (input.seasonId ? await database.season.findFirst({ where: { id: input.seasonId, saveId: save.id } }) : null) ??
    (await database.season.findFirst({ where: { id: "season-1", saveId: save.id } })) ??
    (await database.season.findFirst({ where: { saveId: save.id }, orderBy: [{ year: "asc" }] }));

  if (!season) {
    throw new Error(`No season available for save ${save.id}.`);
  }

  return { saveId: save.id, seasonId: season.id };
}

export async function listTransfermarktFreeAgents(
  input: TransfermarktReadParams = {},
  database?: DatabaseLike,
): Promise<TransfermarktReadResult> {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is missing. Transfermarkt read requires a configured Prisma database.");
  }

  const activeDatabase = database ?? (db as unknown as DatabaseLike);
  const scope = await resolveTransfermarktScope(activeDatabase, input);
  const [players, activePlayers, sheetStatsByName] = await Promise.all([
    activeDatabase.player.findMany({
      select: {
        id: true,
        name: true,
        portraitPath: true,
        portraitUrl: true,
        className: true,
        race: true,
        alignment: true,
        gender: true,
        subclasses: true,
        traitsPositive: true,
        traitsNegative: true,
        preferredDisciplineIds: true,
        attributes: {
          select: {
            rating: true,
            marketValue: true,
            salaryDemand: true,
            displayMarketValue: true,
            displaySalary: true,
            pow: true,
            spe: true,
            men: true,
            soc: true,
            above20: true,
            above40: true,
            above60: true,
            above80: true,
          },
        },
        disciplineScores: {
          select: {
            score: true,
            discipline: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: [{ name: "asc" }],
    }),
    activeDatabase.activePlayer.findMany({
      where: {
        saveId: scope.saveId,
        seasonId: scope.seasonId,
      },
      select: {
        playerId: true,
        teamId: true,
        salary: true,
        player: {
          select: {
            race: true,
            alignment: true,
            subclasses: true,
            traitsPositive: true,
            traitsNegative: true,
          },
        },
      },
    }),
    loadTransfermarktSheetStats().catch(() => new Map()),
  ]);

  const activePlayerIds = new Set(activePlayers.map((entry) => entry.playerId));
  const rosterCountByTeamId = new Map<string, number>();
  for (const row of activePlayers as Array<{ playerId: string; teamId?: string; salary?: number }>) {
    if (typeof row.teamId === "string") {
      rosterCountByTeamId.set(row.teamId, (rosterCountByTeamId.get(row.teamId) ?? 0) + 1);
    }
  }
  const normalizedQuery = input.search ? normalizeSearch(input.search) : null;

  const filtered = players
    .filter((player) => !activePlayerIds.has(player.id))
    .filter((player) => {
      if (!normalizedQuery) {
        return true;
      }

      return (
        player.name.toLocaleLowerCase("de").includes(normalizedQuery) ||
        player.className.toLocaleLowerCase("de").includes(normalizedQuery) ||
        player.race.toLocaleLowerCase("de").includes(normalizedQuery)
      );
    })
    .filter((player) => {
      const marketValue = getDisplayedMarketValue(player, sheetStatsByName.get(normalizeSearch(player.name)));
      if (input.minMarketValue != null && (marketValue == null || marketValue < input.minMarketValue)) {
        return false;
      }
      if (input.maxMarketValue != null && (marketValue == null || marketValue > input.maxMarketValue)) {
        return false;
      }
      return true;
    })
    .sort((left, right) => {
      const leftValue = getDisplayedMarketValue(left, sheetStatsByName.get(normalizeSearch(left.name))) ?? -1;
      const rightValue = getDisplayedMarketValue(right, sheetStatsByName.get(normalizeSearch(right.name))) ?? -1;
      if (leftValue !== rightValue) {
        return rightValue - leftValue;
      }

      const leftRating = left.disciplineScores.reduce((max, entry) => Math.max(max, entry.score), 0);
      const rightRating = right.disciplineScores.reduce((max, entry) => Math.max(max, entry.score), 0);
      if (leftRating !== rightRating) {
        return rightRating - leftRating;
      }

      return left.name.localeCompare(right.name, "de", { sensitivity: "base" });
    });

  const total = filtered.length;
  const limit = input.limit != null ? Math.max(1, Math.min(input.limit, 250)) : 100;
  const playerRatingById = new Map(
    buildPlayerRatingContractRows({
      players: players.map(
        (player) =>
          ({
            id: player.id,
            name: player.name,
            rating: player.attributes?.rating ?? Number.NaN,
            marketValue: player.attributes?.marketValue ?? 0,
            salaryDemand: player.attributes?.salaryDemand ?? 0,
            displayMarketValue: player.attributes?.displayMarketValue ?? player.attributes?.marketValue ?? null,
            displaySalary: player.attributes?.displaySalary ?? player.attributes?.salaryDemand ?? null,
            cost: player.attributes?.marketValue ?? 0,
            upkeepBase: player.attributes?.salaryDemand ?? 0,
            className: player.className,
            race: player.race,
            alignment: player.alignment,
            gender: player.gender,
            referenceClass: null,
            imageSource: null,
            bracketLabel: null,
            subclasses: toStringArray(player.subclasses),
            traitsPositive: toStringArray(player.traitsPositive),
            traitsNegative: toStringArray(player.traitsNegative),
            preferredDisciplineIds: toStringArray(player.preferredDisciplineIds),
            coreStats: {
              pow: player.attributes?.pow ?? 0,
              spe: player.attributes?.spe ?? 0,
              men: player.attributes?.men ?? 0,
              soc: player.attributes?.soc ?? 0,
            },
            disciplineRatings: Object.fromEntries(
              player.disciplineScores.map((entry) => [entry.discipline.id, Number(entry.score.toFixed(2))] as const),
            ),
            disciplineTierCounts: {
              above20: player.attributes?.above20 ?? 0,
              above40: player.attributes?.above40 ?? 0,
              above60: player.attributes?.above60 ?? 0,
              above80: player.attributes?.above80 ?? 0,
            },
            flavorEn: "",
            flavorDe: "",
            fatigue: 0,
            form: 0,
            potential: 0,
            portraitPath: player.portraitPath ?? null,
            portraitUrl: player.portraitUrl ?? null,
          }) as unknown as Player,
      ),
    }).map((row) => [row.playerId, row] as const),
  );
  let teamContext: TransfermarktReadResult["teamContext"] = null;
  let rosterFitPlayers: Array<{
    race: string;
    alignment: string;
    subclasses: string[];
    traitsPositive: string[];
    traitsNegative: string[];
  }> = [];
  if (input.teamId && activeDatabase.teamSeasonState) {
    const teamState = await activeDatabase.teamSeasonState.findFirst({
      where: {
        saveId: scope.saveId,
        seasonId: scope.seasonId,
        teamId: input.teamId,
      },
    });

    if (teamState) {
      const rosterCount = rosterCountByTeamId.get(teamState.teamId) ?? 0;
      const teamSalary = activePlayers
        .filter((row) => row.teamId === teamState.teamId)
        .reduce((sum, row) => sum + (row.salary ?? 0), 0);
      rosterFitPlayers = activePlayers
        .filter((row) => row.teamId === teamState.teamId && row.player)
        .map((row) => ({
          race: row.player?.race ?? "",
          alignment: row.player?.alignment ?? "",
          subclasses: toStringArray(row.player?.subclasses),
          traitsPositive: toStringArray(row.player?.traitsPositive),
          traitsNegative: toStringArray(row.player?.traitsNegative),
        }));
      const cheapestVisiblePlayerCost = filtered.reduce((minimum, player) => {
        const playerCost = getPlayerCost(player, sheetStatsByName.get(normalizeSearch(player.name)));
        if (playerCost == null) {
          return minimum;
        }
        return Math.min(minimum, playerCost);
      }, Number.POSITIVE_INFINITY);
      const affordabilityStatus =
        !Number.isFinite(cheapestVisiblePlayerCost) || cheapestVisiblePlayerCost <= teamState.cash
          ? "affordable"
          : cheapestVisiblePlayerCost <= teamState.cash * 1.15
            ? "tight"
            : "too_expensive";
      let readinessStatus: LegacyMatchdayReadinessStatus | "unknown" = "unknown";
      if (activeDatabase.matchday) {
        try {
          const matchday = await activeDatabase.matchday.findFirst({
            where: { seasonId: scope.seasonId },
            orderBy: [{ index: "asc" }],
          });
          if (matchday) {
            const loader = new LegacyLineupContextLoader(
              activeDatabase as never,
              new LegacyLineupRepository(activeDatabase as never),
            );
            const loaded = await loader.loadLegacyLineupContext({
              saveId: scope.saveId,
              seasonId: scope.seasonId,
              matchdayId: matchday.id,
              teamId: teamState.teamId,
            });
            if (loaded.ok) {
              readinessStatus = buildLegacyMatchdayReadiness(loaded.context).readinessStatus;
            }
          }
        } catch {
          readinessStatus = "unknown";
        }
      }
      teamContext = {
        teamId: teamState.teamId,
        teamCash: teamState.cash,
        teamSalary,
        rosterCount,
        playerMin: teamState.playerMin,
        playerOpt: teamState.playerOpt,
        readinessStatus,
        affordabilityStatus,
        rosterPressureStatus:
          rosterCount < teamState.playerMin
            ? "under_min"
            : rosterCount < teamState.playerOpt
              ? "under_opt"
              : "at_or_above_opt",
      };
    }
  }

  const items = filtered.slice(0, limit).map<TransfermarktFreeAgentItem>((player) => {
    const sheetStats = sheetStatsByName.get(normalizeSearch(player.name));
    const salary = getDisplayedSalary(player, sheetStats);
    const marketValue = getDisplayedMarketValue(player, sheetStats);
    const subclasses = toStringArray(player.subclasses);
    const traitsPositive = toStringArray(player.traitsPositive);
    const traitsNegative = toStringArray(player.traitsNegative);
    const preferredDisciplineIds = toStringArray(player.preferredDisciplineIds);
    const subclassSlots = getArraySlots(subclasses);
    const positiveTraitSlots = getArraySlots(traitsPositive);
    const negativeTraitSlots = getArraySlots(traitsNegative);
    const mercenary = hasMercenaryTrait({ traitsPositive, traitsNegative });
    const playerRating = playerRatingById.get(player.id) ?? null;
    const fitBreakdown = teamContext
        ? calculateTransfermarktFit(
            {
              race: player.race,
            alignment: player.alignment,
            subclasses,
              traitsPositive,
              traitsNegative,
            },
            rosterFitPlayers,
            { teamId: teamContext.teamId },
          )
      : null;
    const missingFields: string[] = [];
    if (marketValue == null) {
      missingFields.push("marketValue");
    }
    if (salary == null) {
      missingFields.push("salaryDemand");
    }
    const browserSafePortrait = getPlayerPortraitBrowserUrl(player.id, player.portraitUrl, player.portraitPath);
    if (!browserSafePortrait) {
      missingFields.push("missing_or_unresolved_portrait");
    }

    return {
      playerId: player.id,
      name: player.name,
      className: player.className,
      race: player.race,
      alignment: player.alignment,
      gender: player.gender,
      subclasses,
      traitsPositive,
      traitsNegative,
      preferredDisciplineIds,
      subclass1: subclassSlots.first,
      subclass2: subclassSlots.second,
      subclass3: subclassSlots.third,
      traitPos1: positiveTraitSlots.first,
      traitPos2: positiveTraitSlots.second,
      traitPos3: positiveTraitSlots.third,
      traitNeg1: negativeTraitSlots.first,
      traitNeg2: negativeTraitSlots.second,
      traitNeg3: negativeTraitSlots.third,
      marketValue,
      ovr: playerRating?.ovrNormalized ?? null,
      mvs: playerRating?.mvs ?? null,
      salary,
      marketValueSalaryRatio: marketValue != null && salary != null && salary > 0 ? Number((marketValue / salary).toFixed(2)) : null,
      bracket: marketValue == null ? null : getTransfermarktBracket(marketValue),
      salaryStatus: salary == null ? "missing" : "known",
      pow: player.attributes?.pow ?? null,
      spe: player.attributes?.spe ?? null,
      men: player.attributes?.men ?? null,
      soc: player.attributes?.soc ?? null,
      powTier: getTransfermarktTierFromPoints(sheetStats?.pow ?? player.attributes?.pow ?? null),
      speTier: getTransfermarktTierFromPoints(sheetStats?.spe ?? player.attributes?.spe ?? null),
      menTier: getTransfermarktTierFromPoints(sheetStats?.men ?? player.attributes?.men ?? null),
      socTier: getTransfermarktTierFromPoints(sheetStats?.soc ?? player.attributes?.soc ?? null),
      above20: player.attributes?.above20 ?? null,
      above40: player.attributes?.above40 ?? null,
      above60: player.attributes?.above60 ?? null,
      above80: player.attributes?.above80 ?? null,
      powerRating: sheetStats?.powerRating ?? null,
      healthRating: sheetStats?.healthRating ?? null,
      staminaRating: sheetStats?.staminaRating ?? null,
      intelligenceRating: sheetStats?.intelligenceRating ?? null,
      determinationRating: sheetStats?.determinationRating ?? null,
      awarenessRating: sheetStats?.awarenessRating ?? null,
      speedRating: sheetStats?.speedRating ?? null,
      dexterityRating: sheetStats?.dexterityRating ?? null,
      charismaRating: sheetStats?.charismaRating ?? null,
      willRating: sheetStats?.willRating ?? null,
      spiritRating: sheetStats?.spiritRating ?? null,
      tormentRating: sheetStats?.tormentRating ?? null,
      topDisciplineScores: [...player.disciplineScores]
        .sort((left, right) => right.score - left.score)
        .slice(0, 3)
        .map((entry) => ({
          disciplineId: entry.discipline.id,
          disciplineName: entry.discipline.name,
          scoreTier: getTransfermarktTierFromPoints(entry.score),
          ppsLastSeason: null,
        })),
      portraitPath: player.portraitPath ?? null,
      portraitUrl: player.portraitUrl ?? null,
      imageUrl: browserSafePortrait,
      availabilityReason: "free_agent",
      teamContextAvailable: Boolean(teamContext),
      teamCash: teamContext?.teamCash ?? null,
      teamSalary: teamContext?.teamSalary ?? null,
      rosterCount: teamContext?.rosterCount ?? null,
      playerMin: teamContext?.playerMin ?? null,
      playerOpt: teamContext?.playerOpt ?? null,
      readinessStatus: teamContext?.readinessStatus ?? null,
      affordabilityStatus: teamContext?.affordabilityStatus ?? null,
      rosterPressureStatus: teamContext?.rosterPressureStatus ?? null,
      fitRace: fitBreakdown?.fitRace ?? null,
      fitSubclasses: fitBreakdown?.fitSubclasses ?? null,
      fitTraits: fitBreakdown?.fitTraits ?? null,
      fitAlignment: fitBreakdown?.fitAlignment ?? null,
      mercenary,
      fit: fitBreakdown?.teamFit ?? null,
      fitDisplay: teamContext ? String(fitBreakdown?.teamFit ?? 0) : "Team waehlen",
      fitSource: teamContext ? "local_approximation_not_golden_master" : "select_team_for_fit",
      ...(missingFields.length > 0 ? { missingFields } : {}),
    };
  });

  const warnings: string[] = [];
  const missingSalaryCount = items.filter((item) => item.salaryStatus === "missing").length;
  if (missingSalaryCount > 0) {
    warnings.push(`${missingSalaryCount} free agents are missing salaryDemand data.`);
  }
  const unresolvedPortraitCount = items.filter((item) => item.missingFields?.includes("missing_or_unresolved_portrait")).length;
  if (unresolvedPortraitCount > 0) {
    warnings.push(`${unresolvedPortraitCount} free agents are missing_or_unresolved_portrait.`);
  }
  if (input.teamId) {
    warnings.push("teamId adds real team context, but does not filter the free-agent pool.");
    warnings.push("Fit is currently a local Retool-style approximation based on roster-derived race/subclass/trait/alignment counts.");
  }

  return {
    items,
    total,
    scope: {
      saveId: scope.saveId,
      seasonId: scope.seasonId,
      teamId: input.teamId ?? null,
    },
    teamContext,
    source: "derived_free_agents",
    notes: [
      "No Prisma TransferListing model exists yet.",
      "Free agents are currently derived from Player records without an ActivePlayer assignment in the selected save/season scope.",
    ],
    warnings,
    poolAudit: buildTransfermarktPoolAudit({
      activeFreeAgents: items,
      visibleFeed: items,
      candidatePool: null,
    }),
  };
}
