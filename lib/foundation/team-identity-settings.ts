import teamIdentitiesSource from "@/data/source/team-identities.json";
import type { GameState, Team, TeamIdentity, TeamIdentityOverride } from "@/lib/data/olyDataTypes";

export type TeamIdentityAxisBias = {
  axisSum: number;
  pow: number | null;
  spe: number | null;
  men: number | null;
  soc: number | null;
  warning: "identity_axis_sum_zero" | null;
};

function loadDefaultIdentityMap() {
  const rows = structuredClone(teamIdentitiesSource as TeamIdentity[]);
  return new Map(rows.map((row) => [row.teamId, row] as const));
}

function buildFallbackIdentity(team: Team): TeamIdentity {
  return {
    teamId: team.teamId,
    playerType: null,
    pow: 0,
    spe: 0,
    men: 0,
    soc: 0,
    ambition: 0,
    finances: 0,
    boardConfidence: 0,
    harmony: 0,
    manners: 0,
    popularity: 0,
    cooperation: 0,
    playerMin: 0,
    playerOpt: 0,
    sourceNote: "missing_team_identity_default",
  };
}

function mergeIdentity(base: TeamIdentity, override?: TeamIdentityOverride | null): TeamIdentity {
  if (!override) {
    return base;
  }

  return {
    ...base,
    ...override,
    teamId: base.teamId,
    sourceNote: base.sourceNote,
  };
}

export function loadDefaultTeamIdentities(): TeamIdentity[] {
  return structuredClone(teamIdentitiesSource as TeamIdentity[]);
}

export function deriveTeamIdentityAxisBias(
  identity: Pick<TeamIdentity, "pow" | "spe" | "men" | "soc"> | null | undefined,
): TeamIdentityAxisBias | null {
  if (!identity) {
    return null;
  }

  const axisSum = identity.pow + identity.spe + identity.men + identity.soc;
  if (!Number.isFinite(axisSum) || axisSum <= 0) {
    return {
      axisSum: 0,
      pow: null,
      spe: null,
      men: null,
      soc: null,
      warning: "identity_axis_sum_zero",
    };
  }

  return {
    axisSum,
    pow: Math.round((identity.pow / axisSum) * 100),
    spe: Math.round((identity.spe / axisSum) * 100),
    men: Math.round((identity.men / axisSum) * 100),
    soc: Math.round((identity.soc / axisSum) * 100),
    warning: null,
  };
}

export function deriveTeamIdentityAxisWeightMap(
  identity: Pick<TeamIdentity, "pow" | "spe" | "men" | "soc"> | null | undefined,
) {
  const derived = deriveTeamIdentityAxisBias(identity);
  if (!derived || derived.warning) {
    return {
      pow: 0,
      spe: 0,
      men: 0,
      soc: 0,
    };
  }

  return {
    pow: (derived.pow ?? 0) / 100,
    spe: (derived.spe ?? 0) / 100,
    men: (derived.men ?? 0) / 100,
    soc: (derived.soc ?? 0) / 100,
  };
}

export function buildResolvedTeamIdentities(
  teams: Team[],
  existingTeamIdentities?: TeamIdentity[] | null,
  overrides?: Record<string, TeamIdentityOverride> | null,
): TeamIdentity[] {
  const defaultsByTeamId = loadDefaultIdentityMap();
  const existingByTeamId = new Map((existingTeamIdentities ?? []).map((row) => [row.teamId, row] as const));

  return teams.map((team) => {
    const base = defaultsByTeamId.get(team.teamId) ?? existingByTeamId.get(team.teamId) ?? buildFallbackIdentity(team);
    return mergeIdentity(base, overrides?.[team.teamId] ?? null);
  });
}

export function buildTeamIdentityOverrideMap(
  teams: Team[],
  draftMap: Record<string, TeamIdentity>,
): Record<string, TeamIdentityOverride> {
  const defaultsByTeamId = loadDefaultIdentityMap();

  return Object.fromEntries(
    teams.flatMap((team) => {
      const draft = draftMap[team.teamId];
      const defaults = defaultsByTeamId.get(team.teamId);
      if (!draft || !defaults) {
        return [];
      }

      const diff: TeamIdentityOverride = {};
      const fields: Array<keyof TeamIdentityOverride> = [
        "playerType",
        "pow",
        "spe",
        "men",
        "soc",
        "ambition",
        "finances",
        "boardConfidence",
        "harmony",
        "manners",
        "popularity",
        "cooperation",
        "playerMin",
        "playerOpt",
      ];

      for (const field of fields) {
        if ((draft[field] ?? null) !== (defaults[field] ?? null)) {
          const nextValue = draft[field] ?? null;
          (diff as Record<string, string | number | null>)[field] = nextValue;
        }
      }

      return Object.keys(diff).length > 0 ? [[team.teamId, diff] as const] : [];
    }),
  );
}

export function withNormalizedTeamIdentityOverrides(gameState: GameState): GameState {
  return {
    ...gameState,
    teamIdentities: buildResolvedTeamIdentities(
      gameState.teams,
      gameState.teamIdentities,
      gameState.seasonState.teamIdentityOverrides,
    ),
  };
}
