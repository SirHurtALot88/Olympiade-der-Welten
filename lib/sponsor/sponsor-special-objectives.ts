import type {
  GameState,
  SponsorOfferComponent,
  SponsorStarTier,
  Team,
  TeamIdentity,
  TeamStrategyProfile,
} from "@/lib/data/olyDataTypes";
import { buildTeamSeasonOverviewRows, type TeamManagementSnapshotRow } from "@/lib/foundation/team-management-overview";
import { getTeamDisplaySalaryTotal } from "@/lib/sponsor/sponsor-team-salary-display";
import type { SponsorSpecialTemplateId } from "@/lib/sponsor/sponsor-brand-variants";
import { getFacilityLevel, getTeamFacilityState } from "@/lib/facilities/facility-effects";

export type SponsorAxisKey = "pow" | "spe" | "men" | "soc";

export type SponsorChallengeSpecialKind =
  | "axis_rank_top"
  | "salary_pressure_max"
  | "transfer_profit_min";

const AXIS_META: Record<
  SponsorAxisKey,
  {
    label: string;
    rowKey: keyof Pick<TeamManagementSnapshotRow, "ppsPow" | "ppsSpe" | "ppsMen" | "ppsSoc">;
    profileKey: keyof TeamStrategyProfile;
    identityKey: keyof TeamIdentity;
  }
> = {
  pow: { label: "POW", rowKey: "ppsPow", profileKey: "powBias", identityKey: "pow" },
  spe: { label: "SPE", rowKey: "ppsSpe", profileKey: "speBias", identityKey: "spe" },
  men: { label: "MEN", rowKey: "ppsMen", profileKey: "menBias", identityKey: "men" },
  soc: { label: "SOC", rowKey: "ppsSoc", profileKey: "socBias", identityKey: "soc" },
};

const AXIS_RANK_MILESTONES = [28, 24, 20, 16, 12, 10, 8, 5, 3, 1] as const;

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function getStableUnitHash(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

export function resolveChallengeSlotIndex(seasonId: string, teamId: string) {
  return Math.floor(getStableUnitHash(`${seasonId}:${teamId}:sponsor-challenge-slot`) * 3);
}

const HISTORICAL_AXIS_ROW_KEY: Record<
  SponsorAxisKey,
  keyof Pick<TeamManagementSnapshotRow, "historicalPow" | "historicalSpe" | "historicalMen" | "historicalSoc">
> = {
  pow: "historicalPow",
  spe: "historicalSpe",
  men: "historicalMen",
  soc: "historicalSoc",
};

function getAxisValueForRank(row: TeamManagementSnapshotRow, axis: SponsorAxisKey, gameState?: GameState) {
  const live = Number(row[AXIS_META[axis].rowKey] ?? 0);
  if (live > 0) {
    return live;
  }
  const historical = Number(row[HISTORICAL_AXIS_ROW_KEY[axis]] ?? 0);
  if (historical > 0) {
    return historical;
  }
  if (row.rosterPlayers.length > 0) {
    const sum = row.rosterPlayers.reduce(
      (total, item) => total + Number(item.player.coreStats?.[axis] ?? 0),
      0,
    );
    if (sum > 0) {
      return round1(sum);
    }
  }
  if (gameState) {
    const disciplineTotals = row.disciplineValues ?? {};
    const categoryTotals = { pow: 0, spe: 0, men: 0, soc: 0 };
    for (const discipline of gameState.disciplines) {
      const value = disciplineTotals[normalizeDisciplineKey(discipline.id)];
      if (typeof value !== "number" || !Number.isFinite(value)) {
        continue;
      }
      if (discipline.category === "power") categoryTotals.pow += value;
      if (discipline.category === "speed") categoryTotals.spe += value;
      if (discipline.category === "mental") categoryTotals.men += value;
      if (discipline.category === "social") categoryTotals.soc += value;
    }
    if (categoryTotals[axis] > 0) {
      return round1(categoryTotals[axis]);
    }
  }
  return 0;
}

function normalizeDisciplineKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "_").replace(/-/g, "_");
}

export function getTeamAxisRank(
  rows: TeamManagementSnapshotRow[],
  teamId: string,
  axis: SponsorAxisKey,
  gameState?: GameState,
) {
  const ordered = [...rows]
    .map((row) => ({ teamId: row.teamId, value: getAxisValueForRank(row, axis, gameState) }))
    .sort((left, right) => right.value - left.value);
  if (!ordered.some((entry) => entry.value > 0)) {
    return { rank: null as number | null, teamCount: ordered.length, value: null as number | null };
  }
  const index = ordered.findIndex((entry) => entry.teamId === teamId);
  if (index < 0) {
    return { rank: null as number | null, teamCount: ordered.length, value: null as number | null };
  }
  return { rank: index + 1, teamCount: ordered.length, value: ordered[index]?.value ?? null };
}

/** Realistisches Top-X: erreichbar, aber kein Top-10-Wunsch von Platz 20+. */
export function resolveRealisticAxisTargetRank(currentRank: number | null, teamCount: number): number {
  const rank = currentRank ?? Math.max(20, Math.ceil(teamCount * 0.75));
  if (rank <= 3) {
    return rank;
  }
  const maxJump = rank <= 8 ? 2 : rank <= 14 ? 3 : rank <= 22 ? 4 : rank <= 28 ? 5 : 6;
  let rawTarget = rank - maxJump;
  if (rank > 20) {
    rawTarget = Math.max(14, rawTarget);
  } else if (rank > 14) {
    rawTarget = Math.max(10, rawTarget);
  }
  const milestoneTarget =
    AXIS_RANK_MILESTONES.find((value) => value <= rank - 1 && value >= rawTarget) ?? Math.max(1, rawTarget);
  return Math.max(1, Math.min(rank - 1, milestoneTarget));
}

function getTeamObjectiveToken(team: Team) {
  return `${team.shortCode} ${team.name} ${team.teamId}`.toLowerCase();
}

function getAxisBias(input: {
  axis: SponsorAxisKey;
  identity: TeamIdentity | null;
  profile: TeamStrategyProfile | null;
}) {
  const meta = AXIS_META[input.axis];
  return Number(input.profile?.[meta.profileKey] ?? input.identity?.[meta.identityKey] ?? 0);
}

export function pickPrimaryAxisForTeam(input: {
  team: Team;
  identity: TeamIdentity | null;
  profile: TeamStrategyProfile | null;
}): SponsorAxisKey {
  const token = getTeamObjectiveToken(input.team);
  if (token.includes("giants") || token.includes("t-g")) return "pow";
  if (token.includes("wizards") || token.includes("w-w")) return "men";
  if (token.includes("runners") || token.includes("s-s")) return "spe";
  if (token.includes("teachers") || token.includes("t-t")) return "men";

  return (Object.keys(AXIS_META) as SponsorAxisKey[])
    .map((axis) => ({ axis, bias: getAxisBias({ axis, identity: input.identity, profile: input.profile }) }))
    .sort((left, right) => right.bias - left.bias)[0]?.axis ?? "pow";
}

function getSalaryRank(rows: TeamManagementSnapshotRow[], teamId: string) {
  const ordered = [...rows].sort(
    (left, right) => (left.salaryTotal ?? Number.POSITIVE_INFINITY) - (right.salaryTotal ?? Number.POSITIVE_INFINITY),
  );
  const index = ordered.findIndex((row) => row.teamId === teamId);
  return {
    rank: index >= 0 ? index + 1 : rows.length,
    teamCount: rows.length,
    salaryTotal: ordered[index]?.salaryTotal ?? null,
  };
}

function encodeAxisTarget(axis: SponsorAxisKey, topRank: number) {
  return `${axis}:${topRank}`;
}

export function parseAxisTargetValue(targetValue: SponsorOfferComponent["targetValue"]): {
  axis: SponsorAxisKey;
  topRank: number;
} | null {
  const raw = typeof targetValue === "string" ? targetValue : String(targetValue ?? "");
  const match = /^(pow|spe|men|soc):(\d+)$/.exec(raw);
  if (!match?.[1] || !match[2]) {
    return null;
  }
  return {
    axis: match[1] as SponsorAxisKey,
    topRank: Number.parseInt(match[2], 10),
  };
}

export function pickChallengeSpecialKind(input: {
  seasonId: string;
  teamId: string;
  team: Team;
  identity: TeamIdentity | null;
  profile: TeamStrategyProfile | null;
  rows: TeamManagementSnapshotRow[];
}): SponsorChallengeSpecialKind {
  const salaryRank = getSalaryRank(input.rows, input.teamId);
  const expensiveTeam = salaryRank.rank >= Math.ceil(input.rows.length * 0.55);
  const transferFocus = (input.profile?.bias.sellForProfitAggression ?? 0) >= 7;
  const options: SponsorChallengeSpecialKind[] = ["axis_rank_top"];
  if (expensiveTeam) {
    options.push("salary_pressure_max");
  }
  if (transferFocus) {
    options.push("transfer_profit_min");
  }
  const index = Math.floor(getStableUnitHash(`${input.seasonId}:${input.teamId}:challenge-kind`) * options.length);
  return options[index] ?? "axis_rank_top";
}

export function buildChallengeSpecialComponent(input: {
  gameState: GameState;
  team: Team;
  identity: TeamIdentity | null;
  profile: TeamStrategyProfile | null;
  starTier: SponsorStarTier;
  rewardCash: number;
  seasonId: string;
}): SponsorOfferComponent {
  const rows = buildTeamSeasonOverviewRows({ gameState: input.gameState });
  const row = rows.find((entry) => entry.teamId === input.team.teamId) ?? null;
  const kind = pickChallengeSpecialKind({
    seasonId: input.seasonId,
    teamId: input.team.teamId,
    team: input.team,
    identity: input.identity,
    profile: input.profile,
    rows,
  });
  const demandBoost = input.starTier >= 4 ? 1 : input.starTier >= 3 ? 0 : -1;

  if (kind === "salary_pressure_max" && row) {
    const salaryTotal = row.salaryTotal ?? getTeamDisplaySalaryTotal(input.gameState, input.team.teamId);
    const targetSalary = round1(Math.max(20, salaryTotal * (input.starTier >= 4 ? 0.9 : 0.93)));
    return {
      componentId: "special-salary-pressure",
      kind: "special",
      label: `Gehalt ≤ ${targetSalary} C`,
      targetValue: targetSalary,
      rewardCash: input.rewardCash,
      penaltyCash: Math.max(1, round1(input.rewardCash * 0.2)),
      specialKey: "salary_pressure_max",
    };
  }

  if (kind === "transfer_profit_min" && row) {
    const target = Math.max(3, 5 + demandBoost + (input.starTier >= 5 ? 2 : 0));
    return {
      componentId: "special-transfer-profit",
      kind: "special",
      label: `Transfergewinn ≥ ${target} C`,
      targetValue: target,
      rewardCash: input.rewardCash,
      penaltyCash: Math.max(1, Math.round(input.rewardCash / 3)),
      specialKey: "transfer_profit_min",
    };
  }

  const axis = pickPrimaryAxisForTeam({
    team: input.team,
    identity: input.identity,
    profile: input.profile,
  });
  const axisRank = getTeamAxisRank(rows, input.team.teamId, axis, input.gameState);
  const targetRank = resolveRealisticAxisTargetRank(axisRank.rank, axisRank.teamCount || rows.length);
  const label =
    axisRank.rank != null && axisRank.rank <= 3
      ? `${AXIS_META[axis].label} Top ${targetRank} halten`
      : `${AXIS_META[axis].label} Top ${targetRank}`;

  return {
    componentId: `special-axis-${axis}`,
    kind: "special",
    label,
    targetValue: encodeAxisTarget(axis, targetRank),
    rewardCash: input.rewardCash,
    penaltyCash: Math.max(1, round1(input.rewardCash * 0.18)),
    specialKey: "axis_rank_top",
  };
}

export function buildStandardSpecialComponent(input: {
  templateId: SponsorSpecialTemplateId;
  starTier: SponsorStarTier;
  rewardCash: number;
}): SponsorOfferComponent {
  const demandBoost = input.starTier >= 4 ? 1 : input.starTier >= 3 ? 0 : -1;
  if (input.templateId === "transfer_profit_min") {
    const target = Math.max(3, 5 + demandBoost + (input.starTier >= 5 ? 2 : 0));
    return {
      componentId: "special-transfer-profit",
      kind: "special",
      label: `Transfergewinn ≥ ${target} C`,
      targetValue: target,
      rewardCash: input.rewardCash,
      specialKey: "transfer_profit_min",
    };
  }
  if (input.templateId === "discipline_top3_count") {
    const target = Math.max(1, 2 + demandBoost + (input.starTier >= 5 ? 1 : 0));
    return {
      componentId: "special-discipline-top3",
      kind: "special",
      label: `≥ ${target} Disziplin-Top-3`,
      targetValue: target,
      rewardCash: input.rewardCash,
      specialKey: "discipline_top3_count",
    };
  }
  const colors = input.starTier >= 4 ? 5 : 4;
  return {
    componentId: "special-roster-form",
    kind: "special",
    label: `Kader-Form ${colors} Farben`,
    targetValue: `${colors} Farben`,
    rewardCash: input.rewardCash,
    specialKey: "form_color_cover",
  };
}

/**
 * Fan-Infrastruktur-Klausel (Sponsor-Enhancement 2, optional). Immer-an-Zusatzkomponente auf JEDEM
 * Angebot: belohnt den Bau der Einkommens-Gebäude (fan_shop / arena_upgrade). `targetValue` = minimale
 * Gesamtstufe der beiden Income-Gebäude, ab der die Klausel greift (Schwelle 1 = mindestens ein
 * Income-Gebäude auf L1). Die AUSZAHLUNG skaliert dann in der Settlement mit der tatsächlichen
 * Gesamtstufe (fan_shop-Level + arena_upgrade-Level, gedeckelt) — je mehr Income-Infrastruktur ein
 * Team baut, desto höher der Sponsor-Bonus. Das zieht in die gleiche Richtung wie der
 * Income-Building-Fix (Teams sollen die Einkommens-Gebäude wirklich bauen, auch die arena).
 */
/**
 * Deckel für die Fan-Infrastruktur-Skalierung: ab dieser Income-Gebäude-Gesamtstufe (fan_shop-Level +
 * arena_upgrade-Level) zahlt die Klausel den vollen rewardCash; darunter anteilig. 6 = fan_shop L3 +
 * arena L3 (oder eine L5+L1-Kombi) — solide, aber nicht maximaler Ausbau, damit der Bonus schon bei
 * moderatem Ausbau greift und nicht erst bei voll gemaxten Gebäuden.
 */
export const FAN_INFRASTRUCTURE_LEVEL_CAP = 6;

/** Gesamtstufe der beiden Einkommens-Gebäude eines Teams (fan_shop-Level + arena_upgrade-Level). */
export function fanInfrastructureLevelSum(gameState: GameState, teamId: string): number {
  const facilities = getTeamFacilityState(gameState, teamId);
  return getFacilityLevel(facilities, "fan_shop") + getFacilityLevel(facilities, "arena_upgrade");
}

export function buildFanInfrastructureSpecialComponent(input: { rewardCash: number }): SponsorOfferComponent {
  return {
    componentId: "special-fan-infrastructure",
    kind: "special",
    label: "Fan-Infrastruktur (Fan-Shop / Arena)",
    targetValue: 1,
    rewardCash: input.rewardCash,
    specialKey: "fan_infrastructure",
  };
}

/**
 * Überperformance-Bonus (Sponsor-Enhancement 3, Feinschliff). Immer-an-Zusatzkomponente: zahlt, wenn
 * das Team die Saison DEUTLICH über seiner erwarteten Qualitäts-Platzierung beendet. Die erwartete
 * Platzierung (teamQualityRank, beim Signing eingefroren) MINUS `margin` wird als absolute Ziel-
 * Platzierung in `targetValue` einbetoniert — die Settlement/Evaluator braucht so nur `row.rank <=
 * targetValue` zu prüfen (kein Zugriff auf den Vertrag nötig). Nicht über den Basisbetrag, sondern echte
 * Überperformance über ein Saisonziel.
 */
export function buildBeatExpectedRankSpecialComponent(input: {
  expectedRank: number | null | undefined;
  margin: number;
  rewardCash: number;
}): SponsorOfferComponent | null {
  if (input.expectedRank == null || !Number.isFinite(input.expectedRank)) return null;
  // Nur Teams, die überhaupt Luft nach oben haben (nicht schon Platz 1 erwartet), bekommen die Klausel.
  const targetRank = Math.round(input.expectedRank) - input.margin;
  if (targetRank < 1) return null;
  return {
    componentId: "special-beat-expected-rank",
    kind: "special",
    label: `Saison auf Platz ≤ ${targetRank} beenden (Überperformance)`,
    targetValue: targetRank,
    rewardCash: input.rewardCash,
    specialKey: "beat_expected_rank",
  };
}
