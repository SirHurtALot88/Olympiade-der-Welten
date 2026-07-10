import type { FoundationViewId } from "@/lib/foundation/foundation-view-routing";
import type { SeasonSnapshotRecord } from "@/lib/data/olyDataTypes";

export function shouldLoadSeasonArchiveForView(
  activeView: FoundationViewId,
  options: {
    showExtendedTeamPanels?: boolean;
    playerProfileNeedsArchive?: boolean;
  } = {},
): boolean {
  if (
    activeView === "season" ||
    activeView === "seasonV2" ||
    activeView === "prize" ||
    activeView === "ranks" ||
    activeView === "diszis" ||
    (activeView === "teams" && options.showExtendedTeamPanels === true)
  ) {
    return true;
  }

  if (activeView === "playerProfile" || activeView === "teamProfile") {
    return true;
  }

  return false;
}

export function isSeasonArchiveLoaded(seasonSnapshots: SeasonSnapshotRecord[] | undefined | null): boolean {
  return seasonSnapshots !== undefined;
}

export function isSeasonArchivePendingFetch(input: {
  seasonSnapshots: SeasonSnapshotRecord[] | undefined | null;
  seasonArchiveFetchCompleted?: boolean;
}): boolean {
  if (input.seasonArchiveFetchCompleted) {
    return false;
  }

  if (input.seasonSnapshots === undefined || input.seasonSnapshots === null) {
    return true;
  }

  return input.seasonSnapshots.length === 0;
}

export function shouldRequestSeasonArchiveLoad(input: {
  activeView: FoundationViewId;
  seasonSnapshots: SeasonSnapshotRecord[] | undefined | null;
  showExtendedTeamPanels?: boolean;
  playerProfileNeedsArchive?: boolean;
  archiveLoadInFlight?: boolean;
  seasonArchiveFetchCompleted?: boolean;
}): boolean {
  if (input.archiveLoadInFlight || input.seasonArchiveFetchCompleted) {
    return false;
  }

  if (!shouldLoadSeasonArchiveForView(input.activeView, {
    showExtendedTeamPanels: input.showExtendedTeamPanels,
    playerProfileNeedsArchive: input.playerProfileNeedsArchive,
  })) {
    return false;
  }

  return isSeasonArchivePendingFetch({
    seasonSnapshots: input.seasonSnapshots,
    seasonArchiveFetchCompleted: input.seasonArchiveFetchCompleted,
  });
}
