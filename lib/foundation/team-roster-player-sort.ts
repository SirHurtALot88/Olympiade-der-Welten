const MISSING_SORT_VALUE = Number.NEGATIVE_INFINITY;

function compareOptionalDescendingSortValue(
  left: number | null | undefined,
  right: number | null | undefined,
) {
  if (left == null && right == null) {
    return 0;
  }

  return (right ?? MISSING_SORT_VALUE) - (left ?? MISSING_SORT_VALUE);
}

export function getTeamRosterPlayerOvrSortKey(
  ovr: number | null | undefined,
  marketValue: number | null | undefined,
): number {
  return ovr ?? marketValue ?? MISSING_SORT_VALUE;
}

export function compareTeamRosterPlayersByOvrOrMarketValue(input: {
  left: {
    ovr?: number | null;
    marketValue?: number | null;
    mvs?: number | null;
    pps?: number | null;
    name: string;
  };
  right: {
    ovr?: number | null;
    marketValue?: number | null;
    mvs?: number | null;
    pps?: number | null;
    name: string;
  };
}) {
  const primaryDelta =
    getTeamRosterPlayerOvrSortKey(input.right.ovr, input.right.marketValue) -
    getTeamRosterPlayerOvrSortKey(input.left.ovr, input.left.marketValue);
  if (primaryDelta !== 0) {
    return primaryDelta;
  }

  const mvsDelta = compareOptionalDescendingSortValue(input.left.mvs, input.right.mvs);
  if (mvsDelta !== 0) {
    return mvsDelta;
  }

  const ppsDelta = compareOptionalDescendingSortValue(input.left.pps, input.right.pps);
  if (ppsDelta !== 0) {
    return ppsDelta;
  }

  return input.left.name.localeCompare(input.right.name, "de");
}
