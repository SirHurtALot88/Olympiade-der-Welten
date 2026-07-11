import type { PlayerGeneratorAttributeName } from "@/lib/data/olyDataTypes";
import type { OrganicProgressionAttributeBreakdown } from "@/lib/training/organic-season-progression";

export type AffinityForecastFocusEntry = {
  attribute: string;
  delta: number;
};

export type AffinityForecastFocus = {
  primary: AffinityForecastFocusEntry[];
  weak: AffinityForecastFocusEntry[];
};

export function buildAffinityForecastFocus(input: {
  attributeBreakdown: OrganicProgressionAttributeBreakdown[];
  attributeLabels: Record<PlayerGeneratorAttributeName, string>;
  signatureAttributes: PlayerGeneratorAttributeName[];
  weakAttribute: PlayerGeneratorAttributeName;
}): AffinityForecastFocus {
  const breakdownByAttribute = new Map(input.attributeBreakdown.map((entry) => [entry.attribute, entry] as const));
  const primary = input.signatureAttributes
    .map((attribute) => {
      const row = breakdownByAttribute.get(attribute);
      if (!row) return null;
      return {
        attribute: input.attributeLabels[attribute],
        delta: row.delta,
      };
    })
    .filter((entry): entry is AffinityForecastFocusEntry => Boolean(entry))
    .sort((left, right) => right.delta - left.delta);

  const weakRow = breakdownByAttribute.get(input.weakAttribute);
  const weak = weakRow
    ? [{ attribute: input.attributeLabels[input.weakAttribute], delta: weakRow.delta }]
    : [];

  return { primary, weak };
}

export function buildAffinityAlignedTopGains(input: {
  attributeBreakdown: OrganicProgressionAttributeBreakdown[];
  attributeLabels: Record<PlayerGeneratorAttributeName, string>;
  signatureAttributes: PlayerGeneratorAttributeName[];
  limit?: number;
}): Array<{ attribute: string; before: number; after: number; delta: number }> {
  const limit = input.limit ?? 3;
  const signatureSet = new Set(input.signatureAttributes);
  const positive = input.attributeBreakdown.filter((entry) => entry.delta > 0);
  const signatureGains = positive
    .filter((entry) => signatureSet.has(entry.attribute))
    .sort((left, right) => right.delta - left.delta);
  const otherGains = positive
    .filter((entry) => !signatureSet.has(entry.attribute))
    .sort((left, right) => right.delta - left.delta);

  return [...signatureGains, ...otherGains].slice(0, limit).map((entry) => ({
    attribute: input.attributeLabels[entry.attribute],
    before: entry.before,
    after: entry.after,
    delta: entry.delta,
  }));
}
