import type { PlayerGeneratorAttributeName } from "@/lib/data/olyDataTypes";

export const PLAYER_ATTRIBUTE_CHART_KEYS = [
  "power",
  "health",
  "stamina",
  "intelligence",
  "awareness",
  "determination",
  "speed",
  "dexterity",
] as const satisfies readonly PlayerGeneratorAttributeName[];

export const PLAYER_ATTRIBUTE_CHART_LABELS: Record<(typeof PLAYER_ATTRIBUTE_CHART_KEYS)[number], string> = {
  power: "STR",
  health: "VIT",
  stamina: "STA",
  intelligence: "INT",
  awareness: "AWA",
  determination: "DET",
  speed: "SPD",
  dexterity: "DEX",
};

export function buildAttributeHistoryDelta(
  rows: PlayerAttributeHistoryRow[],
  attribute: (typeof PLAYER_ATTRIBUTE_CHART_KEYS)[number],
) {
  if (rows.length === 0) {
    return null;
  }
  const first = rows[0]?.attributes[attribute];
  const last = rows[rows.length - 1]?.attributes[attribute];
  if (first == null || last == null || !Number.isFinite(first) || !Number.isFinite(last)) {
    return null;
  }
  return Number((last - first).toFixed(1));
}

export type PlayerAttributeHistoryRow = {
  seasonId: string;
  seasonName: string;
  isActiveSeason: boolean;
  attributes: Partial<Record<PlayerGeneratorAttributeName, number>>;
};

type ProgressionEventLike = {
  seasonId: string;
  timestamp: string;
  upgrades: Array<{
    attribute: string;
    fromValue: number;
    toValue: number;
  }>;
};

type SeasonAnchorLike = {
  seasonId: string | null;
  seasonName: string;
  isActiveSeason: boolean;
};

function sortEventsChronologically(events: ProgressionEventLike[]) {
  return [...events].sort((left, right) => {
    const seasonCompare = left.seasonId.localeCompare(right.seasonId, "de", { numeric: true });
    if (seasonCompare !== 0) {
      return seasonCompare;
    }
    return left.timestamp.localeCompare(right.timestamp, "de");
  });
}

function sortSeasonAnchors(rows: SeasonAnchorLike[]) {
  return [...rows].sort((left, right) => {
    const leftKey = left.seasonId ?? left.seasonName;
    const rightKey = right.seasonId ?? right.seasonName;
    return leftKey.localeCompare(rightKey, "de", { numeric: true });
  });
}

function seedAttributesFromEvents(events: ProgressionEventLike[]) {
  const seeded: Partial<Record<PlayerGeneratorAttributeName, number>> = {};
  for (const event of events) {
    for (const upgrade of event.upgrades) {
      const attribute = upgrade.attribute as PlayerGeneratorAttributeName;
      if (!Object.prototype.hasOwnProperty.call(seeded, attribute)) {
        seeded[attribute] = upgrade.fromValue;
      }
    }
  }
  return seeded;
}

function applyUpgradeState(
  state: Partial<Record<PlayerGeneratorAttributeName, number>>,
  upgrade: ProgressionEventLike["upgrades"][number],
) {
  const attribute = upgrade.attribute as PlayerGeneratorAttributeName;
  state[attribute] = upgrade.toValue;
}

export function buildPlayerAttributeHistoryRows(input: {
  seasonAnchors: SeasonAnchorLike[];
  progressionEvents: ProgressionEventLike[];
  baselineAttributes?: Partial<Record<PlayerGeneratorAttributeName, number | null>> | null;
  currentAttributes?: Partial<Record<PlayerGeneratorAttributeName, number | null>> | null;
}): PlayerAttributeHistoryRow[] {
  const anchors = sortSeasonAnchors(input.seasonAnchors).filter((row) => row.seasonId);
  if (anchors.length === 0) {
    return [];
  }

  const events = sortEventsChronologically(input.progressionEvents);
  const state: Partial<Record<PlayerGeneratorAttributeName, number>> = {
    ...seedAttributesFromEvents(events),
  };

  for (const attribute of PLAYER_ATTRIBUTE_CHART_KEYS) {
    const baselineValue = input.baselineAttributes?.[attribute];
    if (baselineValue != null && Number.isFinite(baselineValue)) {
      state[attribute] = baselineValue;
    }
  }

  const rows: PlayerAttributeHistoryRow[] = [];
  let eventIndex = 0;

  for (const anchor of anchors) {
    const seasonId = anchor.seasonId as string;
    while (eventIndex < events.length && events[eventIndex].seasonId.localeCompare(seasonId, "de", { numeric: true }) <= 0) {
      for (const upgrade of events[eventIndex].upgrades) {
        applyUpgradeState(state, upgrade);
      }
      eventIndex += 1;
    }

    const attributes: Partial<Record<PlayerGeneratorAttributeName, number>> = { ...state };
    if (anchor.isActiveSeason && input.currentAttributes) {
      for (const attribute of PLAYER_ATTRIBUTE_CHART_KEYS) {
        const liveValue = input.currentAttributes[attribute];
        if (liveValue != null && Number.isFinite(liveValue)) {
          attributes[attribute] = liveValue;
        }
      }
    }

    if (PLAYER_ATTRIBUTE_CHART_KEYS.some((attribute) => attributes[attribute] != null && Number.isFinite(attributes[attribute]))) {
      rows.push({
        seasonId,
        seasonName: anchor.seasonName,
        isActiveSeason: anchor.isActiveSeason,
        attributes,
      });
    }
  }

  if (rows.length > 0 && input.baselineAttributes) {
    const baselineAttributes: Partial<Record<PlayerGeneratorAttributeName, number>> = {};
    for (const attribute of PLAYER_ATTRIBUTE_CHART_KEYS) {
      const value = input.baselineAttributes[attribute];
      if (value != null && Number.isFinite(value)) {
        baselineAttributes[attribute] = value;
      }
    }
    const firstRow = rows[0];
    const differsFromFirstSeason = PLAYER_ATTRIBUTE_CHART_KEYS.some((attribute) => {
      const baselineValue = baselineAttributes[attribute];
      const firstValue = firstRow?.attributes[attribute];
      return (
        baselineValue != null &&
        firstValue != null &&
        Math.abs(baselineValue - firstValue) > 0.05
      );
    });
    if (differsFromFirstSeason) {
      rows.unshift({
        seasonId: "__player_baseline__",
        seasonName: "Start",
        isActiveSeason: false,
        attributes: baselineAttributes,
      });
    }
  }

  return rows;
}

/**
 * Rohdaten für die annotierte Entwicklungs-Zeitleiste (#60, FM-Attribut-
 * Graph): season-verortete Karriere-Ereignisse aus real vorhandenen Feldern
 * der Spieler-Drawer-Daten — Transfer (`historyRows.transferType`),
 * Verletzung (`historyRows.injuriesCount`/`matchdaysMissed`), Klassenwechsel
 * (`classHistory`) und XP-Ausgabe (`progressionEvents`, nur der bewusste
 * `manual_season_end_xp_spend`-Pfad, nicht die passive organische
 * Progression). Es werden nur Marker für tatsächlich vorhandene Ereignisse
 * gebaut — reine Formatierung/Labels bleiben Sache der UI-Komponente.
 */
export type PlayerCareerEventMarker =
  | { kind: "transfer"; seasonKey: string; transferType: "buy" | "sell" | "contract_exit"; fee: number | null }
  | { kind: "injury"; seasonKey: string; injuriesCount: number; matchdaysMissed: number | null }
  | { kind: "class_change"; seasonKey: string; className: string; previousClassName: string | null }
  | { kind: "xp_spend"; seasonKey: string; xpSpent: number; upgradeCount: number };

type CareerEventHistoryRowLike = {
  seasonId: string | null;
  seasonName: string;
  transferType: "buy" | "sell" | "contract_exit" | null;
  transferFee: number | null;
  injuriesCount: number | null;
  matchdaysMissed: number | null;
};

type CareerEventClassHistoryEntryLike = {
  seasonId: string;
  className: string;
  previousClassName?: string | null;
  reason: "seed" | "organic_progression" | "manual";
};

type CareerEventProgressionEventLike = {
  seasonId: string;
  xpSpent: number;
  source: "manual_season_end_xp_spend" | "organic_season_progression";
  upgrades: Array<{ attribute: string }>;
};

export function buildPlayerCareerEventMarkers(input: {
  historyRows: CareerEventHistoryRowLike[];
  classHistory?: CareerEventClassHistoryEntryLike[] | null;
  progressionEvents?: CareerEventProgressionEventLike[] | null;
}): PlayerCareerEventMarker[] {
  const markers: PlayerCareerEventMarker[] = [];

  for (const row of input.historyRows) {
    const seasonKey = row.seasonId ?? row.seasonName;
    if (row.transferType) {
      markers.push({ kind: "transfer", seasonKey, transferType: row.transferType, fee: row.transferFee ?? null });
    }
    const injuriesCount = row.injuriesCount ?? 0;
    const matchdaysMissed = row.matchdaysMissed ?? 0;
    if (injuriesCount > 0 || matchdaysMissed > 0) {
      markers.push({
        kind: "injury",
        seasonKey,
        injuriesCount,
        matchdaysMissed: row.matchdaysMissed ?? null,
      });
    }
  }

  for (const entry of input.classHistory ?? []) {
    if (entry.reason === "seed") {
      continue;
    }
    if (!entry.previousClassName || entry.previousClassName === entry.className) {
      continue;
    }
    markers.push({
      kind: "class_change",
      seasonKey: entry.seasonId,
      className: entry.className,
      previousClassName: entry.previousClassName,
    });
  }

  const xpBySeasonKey = new Map<string, { xpSpent: number; upgradeCount: number }>();
  for (const event of input.progressionEvents ?? []) {
    if (event.source !== "manual_season_end_xp_spend" || !(event.xpSpent > 0)) {
      continue;
    }
    const existing = xpBySeasonKey.get(event.seasonId) ?? { xpSpent: 0, upgradeCount: 0 };
    existing.xpSpent += event.xpSpent;
    existing.upgradeCount += event.upgrades.length;
    xpBySeasonKey.set(event.seasonId, existing);
  }
  for (const [seasonKey, aggregate] of xpBySeasonKey) {
    markers.push({ kind: "xp_spend", seasonKey, xpSpent: aggregate.xpSpent, upgradeCount: aggregate.upgradeCount });
  }

  return markers;
}
