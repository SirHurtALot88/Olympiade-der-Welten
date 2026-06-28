import type { PlayerProgressionSpendEventRecord } from "@/lib/data/olyDataTypes";

export type PlayerTrainingHistoryRow = {
  eventId: string;
  seasonId: string;
  source: "organic" | "legacy_xp";
  trainingClass: string | null;
  secondaryTrainingClass: string | null;
  trainingMode: string | null;
  classBefore: string | null;
  classAfter: string | null;
  netSetpoints: number | null;
  trainingSetpoints: number | null;
  performanceSetpoints: number | null;
  traitModifierPct: number | null;
  attributeSummary: string;
  upgrades: Array<{
    attribute: string;
    fromValue: number;
    toValue: number;
    delta: number;
  }>;
  timestamp: string;
};

type ClassHistoryEntry = {
  seasonId: string;
  className: string;
  previousClassName?: string | null;
};

type OrganicProgressionSnapshot = {
  seasonId: string;
  trainingClass: string;
  secondaryTrainingClass?: string | null;
  trainingMode: string;
  classBefore: string;
  classAfter: string;
  netSetpoints: number;
  trainingSetpoints: number;
  performanceSetpoints?: number;
  appliedPerformanceSetpoints?: number;
};

function formatAttributeSummary(
  upgrades: PlayerTrainingHistoryRow["upgrades"],
) {
  if (upgrades.length === 0) {
    return "—";
  }
  return upgrades
    .map((upgrade) => `${upgrade.attribute} ${upgrade.fromValue}→${upgrade.toValue}`)
    .join(", ");
}

function resolveClassForSeason(input: {
  seasonId: string;
  classHistory: ClassHistoryEntry[];
  organicSnapshot: OrganicProgressionSnapshot | null | undefined;
}) {
  const historyEntry = input.classHistory.find((entry) => entry.seasonId === input.seasonId) ?? null;
  if (input.organicSnapshot?.seasonId === input.seasonId) {
    return {
      classBefore: input.organicSnapshot.classBefore,
      classAfter: input.organicSnapshot.classAfter,
      trainingClass: input.organicSnapshot.trainingClass,
      secondaryTrainingClass: input.organicSnapshot.secondaryTrainingClass ?? null,
      trainingMode: input.organicSnapshot.trainingMode,
      netSetpoints: input.organicSnapshot.netSetpoints,
      trainingSetpoints: input.organicSnapshot.trainingSetpoints,
      performanceSetpoints:
        input.organicSnapshot.appliedPerformanceSetpoints ?? input.organicSnapshot.performanceSetpoints ?? null,
    };
  }
  return {
    classBefore: historyEntry?.previousClassName ?? null,
    classAfter: historyEntry?.className ?? null,
    trainingClass: historyEntry?.className ?? null,
    secondaryTrainingClass: null,
    trainingMode: null,
    netSetpoints: null,
    trainingSetpoints: null,
    performanceSetpoints: null,
  };
}

export function buildPlayerTrainingHistoryRows(input: {
  progressionEvents: PlayerProgressionSpendEventRecord[];
  classHistory?: ClassHistoryEntry[];
  organicSnapshot?: OrganicProgressionSnapshot | null;
  currentTrainingClass?: string | null;
  currentTrainingMode?: string | null;
}): PlayerTrainingHistoryRow[] {
  const classHistory = input.classHistory ?? [];
  return [...input.progressionEvents]
    .filter((event) => event.source === "organic_season_progression")
    .sort((left, right) => right.timestamp.localeCompare(left.timestamp, "de"))
    .map((event) => {
      const organicMeta = event.organicMeta ?? null;
      const classContext = resolveClassForSeason({
        seasonId: event.seasonId,
        classHistory,
        organicSnapshot: input.organicSnapshot,
      });
      const upgrades = event.upgrades.map((upgrade) => ({
        attribute: upgrade.attribute,
        fromValue: upgrade.fromValue,
        toValue: upgrade.toValue,
        delta: Number((upgrade.toValue - upgrade.fromValue).toFixed(1)),
      }));

      const isOrganic = event.source === "organic_season_progression";
      const trainingClass =
        organicMeta?.trainingClass ??
        classContext.trainingClass ??
        (isOrganic ? input.currentTrainingClass ?? null : null);
      const trainingMode = organicMeta?.trainingMode ?? classContext.trainingMode ?? (isOrganic ? input.currentTrainingMode ?? null : null);

      return {
        eventId: event.eventId,
        seasonId: event.seasonId,
        source: "organic",
        trainingClass,
        secondaryTrainingClass: organicMeta?.secondaryTrainingClass ?? classContext.secondaryTrainingClass,
        trainingMode,
        classBefore: organicMeta?.classBefore ?? classContext.classBefore,
        classAfter: organicMeta?.classAfter ?? classContext.classAfter,
        netSetpoints: organicMeta?.netSetpoints ?? classContext.netSetpoints,
        trainingSetpoints: organicMeta?.trainingSetpoints ?? classContext.trainingSetpoints,
        performanceSetpoints: organicMeta?.performanceSetpoints ?? classContext.performanceSetpoints,
        traitModifierPct: organicMeta?.traitModifierPct ?? null,
        attributeSummary: formatAttributeSummary(upgrades),
        upgrades,
        timestamp: event.timestamp,
      };
    });
}
