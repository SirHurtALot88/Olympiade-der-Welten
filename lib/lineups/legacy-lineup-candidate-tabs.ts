export type LegacyLineupCandidateTab = "all" | "instant" | "alternative" | "blocked";

/**
 * Maps a candidate quality group key (instant/alternative/fatigue/blocked/emergency, see
 * `TeamdeckCandidateQualityKey` in LegacyLineupLabClient.tsx) onto the coarser tab set shown
 * in the Einsatzliste v2 focus panel (Alle/Sofort/Alternative/Blockiert).
 */
export function mapLegacyLineupCandidateGroupToTab(groupKey: string): LegacyLineupCandidateTab {
  if (groupKey === "instant") return "instant";
  if (groupKey === "blocked") return "blocked";
  return "alternative";
}

/**
 * Shared filter used both by the v2 focus board (for rendering) and by the lineup lab client
 * (for resolving keyboard digit-shortcuts / top-pick). Keeping this identical in both places
 * guarantees that pressing "1"-"4" always assigns the candidate that is visually shown at that
 * position, even while a tab/search filter is active.
 */
export function filterLegacyLineupCandidateEntries<TEntry extends { player: { name: string } }>(
  groups: Array<{ key: string; entries: TEntry[] }>,
  tab: LegacyLineupCandidateTab,
  searchFilter: string,
): TEntry[] {
  const normalizedFilter = searchFilter.trim().toLowerCase();
  const tabbed = groups.flatMap((group) =>
    tab === "all" || mapLegacyLineupCandidateGroupToTab(group.key) === tab ? group.entries : [],
  );
  if (!normalizedFilter) {
    return tabbed;
  }
  return tabbed.filter((entry) => entry.player.name.toLowerCase().includes(normalizedFilter));
}
