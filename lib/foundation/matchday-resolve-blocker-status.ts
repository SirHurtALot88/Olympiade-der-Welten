import type { ResolvePreviewStatus } from "@/lib/resolve/legacy-matchday-resolve-types";

export type MatchdayResolveBlockerPreview = {
  preview: {
    status: ResolvePreviewStatus;
  };
  teamRows: Array<{
    teamId: string;
    status?: ResolvePreviewStatus | string;
    readinessStatus?: ResolvePreviewStatus | string;
  }>;
};

export function extractMatchdayResolveBlockerStatus(input: {
  preview: MatchdayResolveBlockerPreview | null;
  activeTeamId?: string | null;
}): ResolvePreviewStatus | null {
  if (!input.preview) {
    return null;
  }

  const activeTeamRow = input.activeTeamId
    ? input.preview.teamRows.find((row) => row.teamId === input.activeTeamId) ?? null
    : null;
  const activeTeamStatus = activeTeamRow?.status ?? activeTeamRow?.readinessStatus ?? null;
  if (activeTeamStatus && activeTeamStatus !== "ready") {
    return activeTeamStatus as ResolvePreviewStatus;
  }

  return input.preview.preview.status === "ready" ? null : input.preview.preview.status;
}
