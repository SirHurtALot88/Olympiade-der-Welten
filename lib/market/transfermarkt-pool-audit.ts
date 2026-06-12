import type { TransfermarktFreeAgentItem } from "@/lib/market/transfermarkt-read-service";

function roundValue(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

export type TransfermarktPoolBucket = {
  label: "0-5" | "5-10" | "10-20" | "20-30" | "30-50" | "50+";
  count: number;
};

export type TransfermarktPoolAudit = {
  activeFreeAgentCount: number;
  visibleFeedCount: number;
  marketValueBuckets: TransfermarktPoolBucket[];
  cheapestVisiblePlayer: {
    playerId: string;
    name: string;
    marketValue: number | null;
  } | null;
  cheapestBuyablePlayer: {
    playerId: string;
    name: string;
    marketValue: number | null;
  } | null;
  cheapestCandidatePoolPlayer: {
    playerId: string;
    name: string;
    marketValue: number | null;
  } | null;
};

function createBuckets(): TransfermarktPoolBucket[] {
  return [
    { label: "0-5", count: 0 },
    { label: "5-10", count: 0 },
    { label: "10-20", count: 0 },
    { label: "20-30", count: 0 },
    { label: "30-50", count: 0 },
    { label: "50+", count: 0 },
  ];
}

function getBucketLabel(value: number): TransfermarktPoolBucket["label"] {
  if (value < 5) return "0-5";
  if (value < 10) return "5-10";
  if (value < 20) return "10-20";
  if (value < 30) return "20-30";
  if (value < 50) return "30-50";
  return "50+";
}

function getCheapest(items: TransfermarktFreeAgentItem[]) {
  const candidate = [...items]
    .filter((item) => item.marketValue != null && Number.isFinite(item.marketValue))
    .sort((left, right) => {
      const delta = (left.marketValue ?? Number.POSITIVE_INFINITY) - (right.marketValue ?? Number.POSITIVE_INFINITY);
      if (delta !== 0) {
        return delta;
      }
      return left.name.localeCompare(right.name, "de");
    })[0];

  if (!candidate) {
    return null;
  }

  return {
    playerId: candidate.playerId,
    name: candidate.name,
    marketValue: candidate.marketValue != null ? roundValue(candidate.marketValue, 2) : null,
  };
}

export function buildTransfermarktPoolAudit(input: {
  activeFreeAgents: TransfermarktFreeAgentItem[];
  visibleFeed: TransfermarktFreeAgentItem[];
  candidatePool?: TransfermarktFreeAgentItem[] | null;
}) {
  const buckets = createBuckets();
  for (const item of input.activeFreeAgents) {
    const marketValue = item.marketValue;
    if (marketValue == null || !Number.isFinite(marketValue)) {
      continue;
    }
    const bucket = buckets.find((entry) => entry.label === getBucketLabel(marketValue));
    if (bucket) {
      bucket.count += 1;
    }
  }

  return {
    activeFreeAgentCount: input.activeFreeAgents.length,
    visibleFeedCount: input.visibleFeed.length,
    marketValueBuckets: buckets,
    cheapestVisiblePlayer: getCheapest(input.visibleFeed),
    cheapestBuyablePlayer: getCheapest(
      input.visibleFeed.filter((item) => item.affordabilityStatus === "affordable"),
    ),
    cheapestCandidatePoolPlayer: getCheapest(input.candidatePool ?? []),
  } satisfies TransfermarktPoolAudit;
}
