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
  /**
   * POTENZIAL-DRIFT DIESER SAISON — der Wert VOR und NACH dem Saisonende-Drift.
   *
   * GEMELDET VON CHRIS: „sollte potential sich nicht leicht über die seasons ändern können? was
   * wäre da sinnvoll?" Es ändert sich längst: `applySeasonEndPotentialUpdate` driftet den Wert an
   * jedem Saisonende um ±2 Punkte, gerichtet durch den Wachstums-Ausblick (breakout +1,
   * regression_risk −1) und nie auf 0. Nur SEHEN konnte man es nirgends — am Live-Spielstand
   * gemessen sind 1586 Spieler hoch- und 1367 heruntergedriftet, ohne dass es irgendwo stand.
   *
   * `null`, wenn für diese Saison kein Vorher-Wert festgehalten ist. Der Spielstand hält nur den
   * JEWEILS LETZTEN Übergang (`lastSeasonSnapshot`), nicht die ganze Reihe — ältere Saisons
   * bleiben deshalb leer, statt eine Zahl zu erfinden.
   */
  potentialBefore: number | null;
  potentialAfter: number | null;
  traitModifierPct: number | null;
  attributeSummary: string;
  upgrades: Array<{
    attribute: string;
    fromValue: number;
    toValue: number;
    delta: number;
    /**
     * Herkunft je Attribut — `null`, wenn die Saison vor der Einführung der Felder
     * abgeschlossen wurde. Dann zeigt die Historie nur die Saison-Summen.
     * Spillover zählt zum Training: er IST Trainingsbudget, nur umgeleitet.
     */
    training: number | null;
    performance: number | null;
    regression: number | null;
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
  /**
   * Potenzial-Record des Spielers. Liefert ueber `lastSeasonSnapshot` den PO-Wert VOR dem Drift
   * der dort vermerkten Saison; der aktuelle `hiddenPotentialScore` ist der Wert danach.
   */
  potentialRecord?: {
    hiddenPotentialScore?: number | null;
    lastSeasonSnapshot?: { seasonId?: string | null; hiddenPotentialScore?: number | null } | null;
  } | null;
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
      const upgrades = event.upgrades.map((upgrade) => {
        const hatHerkunft =
          typeof upgrade.originTraining === "number" ||
          typeof upgrade.originPerformance === "number" ||
          typeof upgrade.originRegression === "number";
        return {
          attribute: upgrade.attribute,
          fromValue: upgrade.fromValue,
          toValue: upgrade.toValue,
          delta: Number((upgrade.toValue - upgrade.fromValue).toFixed(1)),
          training: hatHerkunft
            ? Number(((upgrade.originTraining ?? 0) + (upgrade.originSpillover ?? 0)).toFixed(1))
            : null,
          performance: hatHerkunft ? Number((upgrade.originPerformance ?? 0).toFixed(1)) : null,
          regression: hatHerkunft ? Number((upgrade.originRegression ?? 0).toFixed(1)) : null,
        };
      });

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
        // Der Drift gehoert GENAU an die Saison, fuer die er vermerkt ist — `lastSeasonSnapshot`
        // haelt nur den letzten Uebergang, jede andere Saison bleibt leer.
        potentialBefore:
          input.potentialRecord?.lastSeasonSnapshot?.seasonId === event.seasonId
            ? input.potentialRecord?.lastSeasonSnapshot?.hiddenPotentialScore ?? null
            : null,
        potentialAfter:
          input.potentialRecord?.lastSeasonSnapshot?.seasonId === event.seasonId
            ? input.potentialRecord?.hiddenPotentialScore ?? null
            : null,
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
