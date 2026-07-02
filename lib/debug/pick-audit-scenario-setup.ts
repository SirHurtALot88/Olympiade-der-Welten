import type { GameState, StandingRecord, TeamGeneralManagerProfile, TeamIdentity } from "@/lib/data/olyDataTypes";
import {
  GM_INFLUENCE_PCT,
  TEAM_GENERAL_MANAGER_PROFILES,
  applyGeneralManagerIdentityEffect,
  applyGeneralManagerStrategyProfileEffect,
  getTeamGeneralManager,
  getTeamGeneralManagerProfile,
} from "@/lib/foundation/team-general-managers";
import { createDefaultTeamStrategyProfile } from "@/lib/foundation/team-strategy-profiles";

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function median(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

function normalizeTeamCode(code: string) {
  return String(code).toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function stripGeneralManagerSourceNote(sourceNote: string | null | undefined) {
  const base = (sourceNote ?? "team_identity").replace(/\s*\+\s*gm:gm-[a-z0-9-]+/gi, "").trim();
  return base.length ? base : "team_identity";
}

function unblendAxis(base: number, target: number, influencePct: number) {
  const weight = influencePct / 100;
  if (weight >= 0.999) return target;
  return (base - target * weight) / (1 - weight);
}

function unblendManagement(base: number, target: number, influencePct: number) {
  const weight = influencePct / 100;
  if (weight >= 0.999) return target;
  return (base - target * weight) / (1 - weight);
}

function unblendIdentityFromGm(
  identity: TeamIdentity,
  gmProfile: TeamGeneralManagerProfile,
  influencePct: number,
): TeamIdentity {
  const playerOptBefore = identity.playerOpt - gmProfile.playerOptDelta;
  return {
    ...identity,
    sourceNote: stripGeneralManagerSourceNote(identity.sourceNote),
    pow: unblendAxis(identity.pow, gmProfile.pow, influencePct),
    spe: unblendAxis(identity.spe, gmProfile.spe, influencePct),
    men: unblendAxis(identity.men, gmProfile.men, influencePct),
    soc: unblendAxis(identity.soc, gmProfile.soc, influencePct),
    ambition: unblendManagement(identity.ambition, gmProfile.ambition, influencePct),
    finances: unblendManagement(identity.finances, gmProfile.finances, influencePct),
    boardConfidence: unblendManagement(identity.boardConfidence, gmProfile.boardConfidence, influencePct),
    harmony: unblendManagement(identity.harmony, gmProfile.harmony, influencePct),
    manners: unblendManagement(identity.manners, gmProfile.manners, influencePct),
    popularity: unblendManagement(identity.popularity, gmProfile.popularity, influencePct),
    cooperation: unblendManagement(identity.cooperation, gmProfile.cooperation, influencePct),
    playerOpt: playerOptBefore,
    playerMin: Math.min(identity.playerMin, playerOptBefore),
  };
}

export type PickAuditGmOverrideRecord = {
  teamCode: string;
  teamId: string;
  fromGmId: string | null;
  fromArchetype: string | null;
  toGmId: string;
  toArchetype: string;
};

function parsePickAuditGmOverrides(raw: string | undefined) {
  if (!raw?.trim()) return [] as Array<{ teamCode: string; target: string }>;
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [teamCode, target] = entry.split(":").map((part) => part.trim());
      if (!teamCode || !target) {
        throw new Error(`Invalid OLY_PICK_AUDIT_GM_OVERRIDE entry "${entry}" (expected TEAM:archetype or TEAM:gm-id)`);
      }
      return { teamCode: normalizeTeamCode(teamCode), target };
    });
}

function resolveGmProfile(target: string, usedGmIds: Set<string>) {
  if (target.startsWith("gm-")) {
    const profile = getTeamGeneralManagerProfile(target);
    if (!profile) throw new Error(`Unknown GM id "${target}"`);
    return profile;
  }
  const candidates = TEAM_GENERAL_MANAGER_PROFILES.filter((profile) => profile.archetype === target);
  if (candidates.length === 0) {
    throw new Error(`Unknown GM archetype "${target}"`);
  }
  return candidates.find((profile) => !usedGmIds.has(profile.gmId)) ?? candidates[0]!;
}

function applyPickAuditGmOverrides(gameState: GameState): {
  gameState: GameState;
  gmOverrides: PickAuditGmOverrideRecord[];
} {
  const entries = parsePickAuditGmOverrides(process.env.OLY_PICK_AUDIT_GM_OVERRIDE);
  if (entries.length === 0) {
    return { gameState, gmOverrides: [] };
  }

  const usedGmIds = new Set(
    Object.values(gameState.seasonState.teamGeneralManagers ?? {})
      .map((assignment) => assignment.gmId)
      .filter(Boolean),
  );
  const assignments = { ...(gameState.seasonState.teamGeneralManagers ?? {}) };
  const teamStrategyProfiles = { ...(gameState.seasonState.teamStrategyProfiles ?? {}) };
  const gmOverrides: PickAuditGmOverrideRecord[] = [];

  let teamIdentities = gameState.teamIdentities;
  for (const entry of entries) {
    const team = gameState.teams.find((candidate) => normalizeTeamCode(candidate.shortCode ?? candidate.teamId) === entry.teamCode);
    if (!team) {
      throw new Error(`Pick-audit GM override team not found: ${entry.teamCode}`);
    }

    const currentGm = getTeamGeneralManager(gameState, team.teamId);
    const nextProfile = resolveGmProfile(entry.target, usedGmIds);
    if (currentGm?.profile.gmId) {
      usedGmIds.delete(currentGm.profile.gmId);
    }
    usedGmIds.add(nextProfile.gmId);

    const influencePct = currentGm?.assignment.influencePct ?? GM_INFLUENCE_PCT;
    const baseIdentity = teamIdentities.find((identity) => identity.teamId === team.teamId);
    if (!baseIdentity) {
      throw new Error(`Missing team identity for ${entry.teamCode}`);
    }
    const strippedIdentity = currentGm?.profile
      ? unblendIdentityFromGm(baseIdentity, currentGm.profile, influencePct)
      : { ...baseIdentity, sourceNote: stripGeneralManagerSourceNote(baseIdentity.sourceNote) };
    const nextIdentity = applyGeneralManagerIdentityEffect(strippedIdentity, nextProfile, influencePct);
    teamIdentities = teamIdentities.map((identity) => (identity.teamId === team.teamId ? nextIdentity : identity));

    const baseStrategyProfile = createDefaultTeamStrategyProfile(team, nextIdentity);
    teamStrategyProfiles[team.teamId] = applyGeneralManagerStrategyProfileEffect(
      baseStrategyProfile,
      nextProfile,
      influencePct,
    );

    assignments[team.teamId] = {
      teamId: team.teamId,
      gmId: nextProfile.gmId,
      assignedSeasonId: gameState.season.id,
      influencePct,
      source: "audit_override",
      previousGmId: currentGm?.profile.gmId,
    };

    gmOverrides.push({
      teamCode: team.shortCode ?? entry.teamCode,
      teamId: team.teamId,
      fromGmId: currentGm?.profile.gmId ?? null,
      fromArchetype: currentGm?.profile.archetype ?? null,
      toGmId: nextProfile.gmId,
      toArchetype: nextProfile.archetype,
    });
  }

  return {
    gameState: {
      ...gameState,
      teamIdentities,
      seasonState: {
        ...gameState.seasonState,
        teamGeneralManagers: assignments,
        teamStrategyProfiles,
      },
    },
    gmOverrides,
  };
}

export type PickAuditScenarioSetupResult = {
  gameState: GameState;
  medianCash: number;
  cashInjectedTeams: number;
  standingsPermutedTeams: number;
  gmOverrides: PickAuditGmOverrideRecord[];
};

export function applyPickAuditScenarioSetup(
  gameState: GameState,
  options?: { salaryFactor?: number },
): PickAuditScenarioSetupResult {
  const salaryFactor = options?.salaryFactor ?? Number(process.env.OLY_PICK_AUDIT_SALARY_FACTOR ?? "1");
  const salaryMultiplier = Number.isFinite(salaryFactor) && salaryFactor > 0 ? salaryFactor : 1;
  const cashValues = gameState.teams.map((team) => team.cash).filter((value) => Number.isFinite(value));
  const medianCash = round(median(cashValues), 2);
  let cashInjectedTeams = 0;

  const teams = gameState.teams.map((team) => {
    const jitterPct = ((stableHash(`${team.teamId}:cash`) % 41) - 20) / 100;
    const inject = round(medianCash * jitterPct, 2);
    if (Math.abs(inject) < 0.01) return team;
    cashInjectedTeams += 1;
    return { ...team, cash: round(Math.max(0, team.cash + inject), 2) };
  });

  const standings = { ...(gameState.seasonState.standings ?? {}) };
  const teamCount = gameState.teams.length;
  const ranked = gameState.teams
    .map((team) => ({
      teamId: team.teamId,
      rank: standings[team.teamId]?.rank ?? teamCount,
    }))
    .sort((left, right) => left.rank - right.rank);

  let standingsPermutedTeams = 0;
  const nextStandings: Record<string, StandingRecord> = { ...standings };
  for (const entry of ranked) {
    const current = standings[entry.teamId] ?? { points: 0, rank: entry.rank };
    const shift = (stableHash(`${entry.teamId}:rank`) % 7) - 3;
    const nextRank = clamp(entry.rank + shift, 1, teamCount);
    if (nextRank !== entry.rank) standingsPermutedTeams += 1;
    nextStandings[entry.teamId] = {
      ...current,
      rank: nextRank,
      startplatz: current.startplatz ?? entry.rank,
      rankDiff: nextRank - (current.startplatz ?? entry.rank),
    };
  }

  const staged = {
    ...gameState,
    teams,
    rosters:
      salaryMultiplier === 1
        ? gameState.rosters
        : gameState.rosters.map((entry) => ({
            ...entry,
            salary: round((entry.salary ?? entry.upkeep ?? 0) * salaryMultiplier, 2),
            upkeep: round((entry.upkeep ?? entry.salary ?? 0) * salaryMultiplier, 2),
          })),
    seasonState: {
      ...gameState.seasonState,
      standings: nextStandings,
    },
  };
  const { gameState: withGmOverrides, gmOverrides } = applyPickAuditGmOverrides(staged);

  return {
    gameState: withGmOverrides,
    medianCash,
    cashInjectedTeams,
    standingsPermutedTeams,
    gmOverrides,
  };
}
