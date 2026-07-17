import type {
  GameState,
  SponsorArchetype,
  SponsorObjectiveStage,
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

export function resolveChallengeSlotIndex(seasonId: string, teamId: string, slotCount = 5) {
  return Math.floor(getStableUnitHash(`${seasonId}:${teamId}:sponsor-challenge-slot`) * slotCount);
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

// =====================================================================================================
// TEIL B — Sponsor-Bonusziele (14 Standard + 6 Golden) + stages/spotlightBonus-Framework.
//
// Jedes Bonusziel ist ein `special`-Komponententyp mit einem `specialKey`, optional `stages` (mehrstufige,
// anteilige Auszahlung) und optional `spotlightBonus` (Beliebtheits-Impuls bei Erfüllung). Der Evaluator
// (sponsor-objective-evaluator) liefert für jeden Key eine ERREICHTE STUFE (Fraction 0..1); die Settlement
// zahlt `rewardCash * fraction`. Bestehende binäre Keys (ohne `stages`) bleiben unberührt (Fraction 0/1).
//
// Alle Schwellen sind ENV-tunebar (OLY_SPONSOR_OBJ_*). Die Startwerte sind plausibel gesetzt und werden
// final kalibriert.
// =====================================================================================================

function objEnvNumber(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Der neue Bonusziel-Katalog (14 Standard). Bestehende Keys (axis/salary/transfer/discipline/form/…) bleiben separat. */
export type SponsorBonusObjectiveKey =
  // Performance-Archetyp
  | "underdog_story"
  | "momentum_series"
  | "discipline_dominance"
  | "axis_ascension"
  // Identity-Archetyp
  | "fan_cult_player"
  | "homegrown_elevation"
  | "rival_humiliation"
  | "fan_infrastructure"
  | "roster_diversity"
  // Security-Archetyp
  | "solvency_series"
  | "salary_discipline"
  | "transfer_trader"
  | "sustainability_architect"
  | "fatigue_management";

/** Die 6 Golden-Bonusziele (nur bei isGolden-Angeboten). */
export type SponsorGoldenObjectiveKey =
  | "golden_fairytale"
  | "golden_crowd_favorites"
  | "golden_talent_forge"
  | "golden_discipline_monopoly"
  | "golden_title_shock"
  | "golden_rival_deluxe";

export type SponsorObjectiveKey = SponsorBonusObjectiveKey | SponsorGoldenObjectiveKey;

/** Roh-Magnitude des Spotlight-Impulses (grob 0..1) — Standard klein, Golden höher. ENV-tunebar. */
export const SPONSOR_OBJ_SPOTLIGHT_STD = objEnvNumber("OLY_SPONSOR_OBJ_SPOTLIGHT_STD", 0.5);
export const SPONSOR_OBJ_SPOTLIGHT_SECURITY = objEnvNumber("OLY_SPONSOR_OBJ_SPOTLIGHT_SECURITY", 0.25);
export const SPONSOR_OBJ_SPOTLIGHT_GOLDEN = objEnvNumber("OLY_SPONSOR_OBJ_SPOTLIGHT_GOLDEN", 1.0);

/** Transfer-Händler (#12): Netto-Cash-Stufen der Wechselperiode (>0 / >X / >2X). */
export const SPONSOR_OBJ_TRANSFER_TRADER_X = objEnvNumber("OLY_SPONSOR_OBJ_TRANSFER_X", 12);
/** Disziplin-Dominanz (#3): guter rankInDiscipline ≤ dieser Rang zählt. */
export const SPONSOR_OBJ_DISCIPLINE_GOOD_RANK = objEnvNumber("OLY_SPONSOR_OBJ_DISCIPLINE_GOOD_RANK", 5);
/** Golden Disziplin-Monopol (G4): Top-K der Disziplin (K = 5, NICHT 3). */
export const SPONSOR_OBJ_GOLDEN_DISCIPLINE_RANK = objEnvNumber("OLY_SPONSOR_OBJ_GOLDEN_DISCIPLINE_RANK", 5);
/** Bracket-Held-Schwelle (bracketScore, 0..1) für Fan-Kult / Publikumsliebling. */
export const SPONSOR_OBJ_BRACKET_HERO = objEnvNumber("OLY_SPONSOR_OBJ_BRACKET_HERO", 0.85);
/** Talentschmiede (G3): Marktwert-Zuwachs eines Spielers in EINER Saison, ab dem ein "großer Sprung" zählt. */
export const SPONSOR_OBJ_TALENT_JUMP_MV = objEnvNumber("OLY_SPONSOR_OBJ_TALENT_JUMP_MV", 6);
/** Titel-Schock (G5): teamQualityRankAtSign ≥ dieser Wert = "schwaches" Team (Eignung). */
export const SPONSOR_OBJ_TITLE_SHOCK_WEAK_RANK = objEnvNumber("OLY_SPONSOR_OBJ_TITLE_SHOCK_WEAK_RANK", 18);
/** Fatigue-Management (#14): Kader-Fatigue ≤ diese Schwelle zählt als "frisch". */
export const SPONSOR_OBJ_FATIGUE_CAP = objEnvNumber("OLY_SPONSOR_OBJ_FATIGUE_CAP", 45);

function stage(threshold: number, fraction: number, label: string): SponsorObjectiveStage {
  return { threshold, fraction, label };
}

/** Standard-3-Stufen-Leiter 40/70/100 %. */
function threeStage(t1: number, t2: number, t3: number, unit: string): SponsorObjectiveStage[] {
  return [
    stage(t1, 0.4, `${unit} ${t1}`),
    stage(t2, 0.7, `${unit} ${t2}`),
    stage(t3, 1.0, `${unit} ${t3}`),
  ];
}

/**
 * Archetyp-Zuordnung der 14 Standard-Bonusziele. Bestimmt, aus welchem Pool ein Archetyp seine Bonusziele
 * ziehen kann (die tatsächliche Angebots-Verdrahtung liegt außerhalb dieses Frameworks).
 */
export const SPONSOR_BONUS_OBJECTIVE_ARCHETYPE: Record<SponsorBonusObjectiveKey, SponsorArchetype> = {
  underdog_story: "performance",
  momentum_series: "performance",
  discipline_dominance: "performance",
  axis_ascension: "performance",
  fan_cult_player: "identity",
  homegrown_elevation: "identity",
  rival_humiliation: "identity",
  fan_infrastructure: "identity",
  roster_diversity: "identity",
  solvency_series: "security",
  salary_discipline: "security",
  transfer_trader: "security",
  sustainability_architect: "security",
  fatigue_management: "security",
};

export const SPONSOR_GOLDEN_OBJECTIVE_ARCHETYPE: Record<SponsorGoldenObjectiveKey, SponsorArchetype> = {
  golden_fairytale: "performance",
  golden_talent_forge: "performance",
  golden_crowd_favorites: "identity",
  golden_rival_deluxe: "identity",
  golden_discipline_monopoly: "performance",
  golden_title_shock: "security",
};

function spotlightForArchetype(archetype: SponsorArchetype): number {
  return archetype === "security" ? SPONSOR_OBJ_SPOTLIGHT_SECURITY : SPONSOR_OBJ_SPOTLIGHT_STD;
}

export type BonusObjectiveBuildInput = {
  gameState: GameState;
  team: Team;
  identity: TeamIdentity | null;
  profile: TeamStrategyProfile | null;
  rewardCash: number;
  starTier: SponsorStarTier;
  seasonId: string;
  /** Optionaler expliziter Rival-Team (für rival_humiliation); sonst wird über den Snapshot heuristisch gewählt. */
  rivalTeamId?: string | null;
  /** Beim Signing eingefrorene Qualitäts-Platzierung (für Titel-Schock G5). */
  teamQualityRank?: number | null;
};

function primaryAxisBaseline(input: BonusObjectiveBuildInput): { axis: SponsorAxisKey; baselineRank: number } {
  const rows = buildTeamSeasonOverviewRows({ gameState: input.gameState });
  const axis = pickPrimaryAxisForTeam({ team: input.team, identity: input.identity, profile: input.profile });
  const axisRank = getTeamAxisRank(rows, input.team.teamId, axis, input.gameState);
  return { axis, baselineRank: axisRank.rank ?? rows.length };
}

/**
 * Wählt heuristisch einen Rivalen: das im Snapshot direkt vor dem Team platzierte Team (nächststärkerer
 * Nachbar). Deterministisch, ohne eigene Rival-Datenquelle.
 */
export function resolveDefaultRivalTeamId(gameState: GameState, teamId: string): string | null {
  const rows = buildTeamSeasonOverviewRows({ gameState });
  const ordered = [...rows].sort((left, right) => (left.rank ?? 99) - (right.rank ?? 99));
  const index = ordered.findIndex((row) => row.teamId === teamId);
  if (index <= 0) {
    return ordered[1]?.teamId ?? null;
  }
  return ordered[index - 1]?.teamId ?? null;
}

/**
 * Baut die special-Komponente eines der 14 Standard-Bonusziele. `targetValue` encodiert dabei die für die
 * Auswertung nötige Kontext-Information (Achse+Baseline, Rival-Id, eingefrorene Qualitäts-Platzierung, …).
 */
export function buildBonusObjectiveComponent(
  key: SponsorBonusObjectiveKey,
  input: BonusObjectiveBuildInput,
): SponsorOfferComponent {
  const archetype = SPONSOR_BONUS_OBJECTIVE_ARCHETYPE[key];
  const spotlightBonus = spotlightForArchetype(archetype);
  const base = {
    kind: "special" as const,
    rewardCash: input.rewardCash,
    spotlightBonus,
  };

  switch (key) {
    case "underdog_story":
      return {
        ...base,
        componentId: "special-underdog-story",
        label: "Underdog-Story (über Erwartung abschneiden)",
        targetValue: "underdog",
        specialKey: "underdog_story",
        stages: threeStage(3, 6, 9, "+"),
      };
    case "momentum_series":
      return {
        ...base,
        componentId: "special-momentum-series",
        label: "Momentum-Serie (starke Spieltage)",
        targetValue: "momentum",
        specialKey: "momentum_series",
        stages: threeStage(3, 5, 7, "Spieltage"),
      };
    case "discipline_dominance":
      return {
        ...base,
        componentId: "special-discipline-dominance",
        label: `Disziplin-Dominanz (Kaderanteil Top-${SPONSOR_OBJ_DISCIPLINE_GOOD_RANK})`,
        targetValue: SPONSOR_OBJ_DISCIPLINE_GOOD_RANK,
        specialKey: "discipline_dominance",
        stages: threeStage(20, 35, 50, "% Kader"),
      };
    case "axis_ascension": {
      const { axis, baselineRank } = primaryAxisBaseline(input);
      return {
        ...base,
        componentId: `special-axis-ascension-${axis}`,
        label: `Achsen-Aufstieg (${AXIS_META[axis].label} verbessern)`,
        targetValue: encodeAxisTarget(axis, baselineRank),
        specialKey: "axis_ascension",
        stages: threeStage(2, 4, 6, "+Ränge"),
      };
    }
    case "fan_cult_player":
      return {
        ...base,
        componentId: "special-fan-cult-player",
        label: "Fan-Kult um einen Spieler",
        targetValue: "fan_cult",
        specialKey: "fan_cult_player",
        stages: [stage(80, 0.5, "Star ≥80"), stage(90, 0.8, "Star ≥90"), stage(100, 1.0, "Star =100")],
      };
    case "homegrown_elevation":
      return {
        ...base,
        componentId: "special-homegrown-elevation",
        label: "Eigengewächs-Veredelung (Nachwuchs → Bracket-Elite)",
        targetValue: "homegrown",
        specialKey: "homegrown_elevation",
        stages: [stage(80, 0.5, "Bracket ≥80"), stage(92, 1.0, "Bracket-Elite")],
      };
    case "rival_humiliation": {
      const rivalTeamId = input.rivalTeamId ?? resolveDefaultRivalTeamId(input.gameState, input.team.teamId);
      return {
        ...base,
        componentId: "special-rival-humiliation",
        label: "Rivalen-Demütigung (Rival hinter sich lassen)",
        targetValue: `rival:${rivalTeamId ?? ""}`,
        specialKey: "rival_humiliation",
        stages: threeStage(1, 4, 8, "+Ränge vor Rival"),
      };
    }
    case "fan_infrastructure":
      return {
        ...base,
        componentId: "special-fan-infrastructure",
        label: "Fan-Infrastruktur (Fan-Shop / Arena)",
        targetValue: 1,
        specialKey: "fan_infrastructure",
      };
    case "roster_diversity": {
      const colors = input.starTier >= 4 ? 5 : 4;
      return {
        ...base,
        componentId: "special-roster-diversity",
        label: `Kader-Vielfalt (${colors} Farben)`,
        targetValue: `${colors} Farben`,
        specialKey: "form_color_cover",
        stages: [stage(3, 0.4, "3 Farben"), stage(4, 0.7, "4 Farben"), stage(5, 1.0, "5 Farben")],
      };
    }
    case "solvency_series":
      return {
        ...base,
        componentId: "special-solvency-series",
        label: "Solvenz-Serie (Kasse positiv halten)",
        targetValue: "solvency",
        specialKey: "solvency_series",
        stages: [stage(0.01, 1.0, "Kasse positiv")],
      };
    case "salary_discipline": {
      const salaryTotal = getTeamDisplaySalaryTotal(input.gameState, input.team.teamId);
      const targetSalary = round1(Math.max(20, salaryTotal * (input.starTier >= 4 ? 0.9 : 0.93)));
      return {
        ...base,
        componentId: "special-salary-discipline",
        label: `Gehaltsdisziplin ≤ ${targetSalary} C`,
        targetValue: targetSalary,
        specialKey: "salary_pressure_max",
      };
    }
    case "transfer_trader": {
      const x = SPONSOR_OBJ_TRANSFER_TRADER_X;
      return {
        ...base,
        componentId: "special-transfer-trader",
        label: "Transfer-Händler (Bilanz dieser Wechselperiode)",
        targetValue: "transfer_window",
        specialKey: "transfer_trader",
        stages: [stage(0.01, 0.4, "Netto >0"), stage(x, 0.7, `Netto >${x}`), stage(2 * x, 1.0, `Netto >${2 * x}`)],
      };
    }
    case "sustainability_architect":
      return {
        ...base,
        componentId: "special-sustainability-architect",
        label: "Nachhaltigkeits-Architekt (Facilities netto ≥ 0)",
        targetValue: "net_facility",
        specialKey: "sustainability_architect",
        stages: [stage(0, 1.0, "Netto ≥ 0")],
      };
    case "fatigue_management":
      return {
        ...base,
        componentId: "special-fatigue-management",
        label: `Fatigue-Management (Kader frisch, ≤ ${SPONSOR_OBJ_FATIGUE_CAP})`,
        targetValue: SPONSOR_OBJ_FATIGUE_CAP,
        specialKey: "fatigue_management",
        stages: threeStage(50, 75, 95, "% frisch"),
      };
  }
}

/**
 * Baut die special-Komponente eines der 6 Golden-Bonusziele (mehrstufig, mit erhöhtem spotlightBonus). Das
 * Golden-Ziel ERSETZT das Standard-Special eines golden Angebots (kein Payout-Bloat).
 */
export function buildGoldenObjectiveComponent(
  key: SponsorGoldenObjectiveKey,
  input: BonusObjectiveBuildInput,
): SponsorOfferComponent {
  const base = {
    kind: "special" as const,
    rewardCash: input.rewardCash,
    spotlightBonus: SPONSOR_OBJ_SPOTLIGHT_GOLDEN,
  };
  switch (key) {
    case "golden_fairytale":
      return {
        ...base,
        componentId: "special-golden-fairytale",
        label: "Die Märchensaison (weit über Erwartung)",
        targetValue: "underdog",
        specialKey: "golden_fairytale",
        stages: threeStage(3, 6, 9, "+"),
      };
    case "golden_crowd_favorites":
      return {
        ...base,
        componentId: "special-golden-crowd-favorites",
        label: "Publikumsliebling-Explosion (Bracket-Helden)",
        targetValue: "bracket_heroes",
        specialKey: "golden_crowd_favorites",
        stages: [stage(1, 0.4, "1 Held"), stage(2, 0.7, "2 Helden"), stage(3, 1.0, "3 Helden")],
      };
    case "golden_talent_forge":
      return {
        ...base,
        componentId: "special-golden-talent-forge",
        label: "Die Talentschmiede (3 Spieler stark entwickeln)",
        targetValue: SPONSOR_OBJ_TALENT_JUMP_MV,
        specialKey: "golden_talent_forge",
        stages: [stage(1, 0.4, "1 Sprung"), stage(2, 0.7, "2 Sprünge"), stage(3, 1.0, "3 Sprünge")],
      };
    case "golden_discipline_monopoly":
      return {
        ...base,
        componentId: "special-golden-discipline-monopoly",
        label: `Disziplin-Monopol (Spieler in Top-${SPONSOR_OBJ_GOLDEN_DISCIPLINE_RANK})`,
        targetValue: SPONSOR_OBJ_GOLDEN_DISCIPLINE_RANK,
        specialKey: "golden_discipline_monopoly",
        stages: [stage(2, 0.4, "2 Spieler"), stage(3, 0.7, "3 Spieler"), stage(4, 1.0, "4 Spieler")],
      };
    case "golden_title_shock": {
      const qualityRank = input.teamQualityRank ?? input.gameState.teams.length;
      return {
        ...base,
        componentId: "special-golden-title-shock",
        label: "Der Titel-Schock (schwaches Team, ganz nach oben)",
        targetValue: `title_shock:${Math.round(qualityRank)}`,
        specialKey: "golden_title_shock",
        stages: [stage(1, 0.5, "Top-3"), stage(2, 0.75, "Top-2"), stage(3, 1.0, "Meister")],
      };
    }
    case "golden_rival_deluxe": {
      const rivalTeamId = input.rivalTeamId ?? resolveDefaultRivalTeamId(input.gameState, input.team.teamId);
      return {
        ...base,
        componentId: "special-golden-rival-deluxe",
        label: "Rivalen-Demütigung deluxe",
        targetValue: `rival:${rivalTeamId ?? ""}`,
        specialKey: "golden_rival_deluxe",
        stages: [stage(5, 0.5, "+5 Ränge"), stage(10, 1.0, "+10 Ränge")],
      };
    }
  }
}

/**
 * Wählt deterministisch (Season-Hash) EIN Golden-Bonusziel, archetyp-gefiltert. Fällt zurück auf den
 * gesamten Golden-Pool, falls der Archetyp keinen eigenen Golden-Eintrag hat.
 */
export function pickGoldenObjective(
  seasonId: string,
  teamId: string,
  archetype: SponsorArchetype,
): SponsorGoldenObjectiveKey {
  const all = Object.keys(SPONSOR_GOLDEN_OBJECTIVE_ARCHETYPE) as SponsorGoldenObjectiveKey[];
  const filtered = all.filter((key) => SPONSOR_GOLDEN_OBJECTIVE_ARCHETYPE[key] === archetype);
  const pool = filtered.length > 0 ? filtered : all;
  const index = Math.floor(getStableUnitHash(`${seasonId}:${teamId}:golden-objective`) * pool.length);
  return pool[Math.min(pool.length - 1, index)] ?? pool[0]!;
}

/**
 * Transfer-Händler (#12) — Fenster-Query. TAG-ZUORDNUNG (im Code verifiziert): jede transferHistory-Zeile
 * trägt `seasonId = gameState.season.id` zum Ausführungszeitpunkt und `phase = "manual_transfer_window"`
 * (LOCAL_TRANSFER_WINDOW_PHASE) — die SESSION-Phase "season_end"/"preseason" wird NICHT auf die Zeile
 * geschrieben. Im kanonischen Ablauf (season-simulation-runner PHASES) laufen innerhalb EINER Saison-
 * Iteration von S zuerst `sell_contract_exits` (Verkäufe) und `buy_draft` (Käufe) — beide VOR jedem
 * Matchday, beide getaggt mit `seasonId = S`. Die Übergangs-Wechselperiode in Saison S ist damit vollständig
 * über `seasonId === S` erfasst und zum Abrechnungszeitpunkt (Saison-Ende, nach allen Matchdays) fertig
 * gebucht. Netto = Σ Verkaufserlöse − Σ Kaufkosten (jeweils netCashImpact ?? fee) für diese Saison.
 */
export function computeTransferWindowNet(gameState: GameState, teamId: string, seasonId: string): number {
  let sells = 0;
  let buys = 0;
  for (const entry of gameState.transferHistory ?? []) {
    if (entry.seasonId !== seasonId) continue;
    const value = typeof entry.netCashImpact === "number" && Number.isFinite(entry.netCashImpact)
      ? entry.netCashImpact
      : typeof entry.fee === "number" && Number.isFinite(entry.fee)
        ? entry.fee
        : 0;
    if (entry.transferType === "sell" && entry.fromTeamId === teamId) {
      sells += value;
    } else if (entry.transferType === "buy" && entry.toTeamId === teamId) {
      buys += value;
    }
  }
  return round1(sells - buys);
}

/**
 * Season-1-Ausschluss für den Transfer-Händler: in Saison 1 gibt es keine Vorsaison-Verkäufe (Teams starten
 * bei 0, nur Draft-Käufe) → das Ziel wird gar nicht angeboten. Ab S2 verfügbar.
 */
export function isTransferTraderAvailableForSeason(seasonId: string): boolean {
  // seasonId ist typischerweise "season-1", "season-2", … — der numerische Suffix ist die Saison-Nummer.
  const match = /(\d+)\s*$/.exec(String(seasonId));
  const seasonNumber = match ? Number.parseInt(match[1]!, 10) : Number.NaN;
  // Kein verlässlicher Suffix → konservativ NICHT ausschließen (nur S1 hart ausschließen).
  return !(Number.isFinite(seasonNumber) && seasonNumber <= 1);
}

/**
 * Pool der Standard-Bonusziele eines Archetyps, saison-gefiltert (Transfer-Händler in S1 ausgeschlossen).
 */
export function getAvailableBonusObjectiveKeys(
  archetype: SponsorArchetype,
  seasonId: string,
): SponsorBonusObjectiveKey[] {
  const keys = (Object.keys(SPONSOR_BONUS_OBJECTIVE_ARCHETYPE) as SponsorBonusObjectiveKey[]).filter(
    (key) => SPONSOR_BONUS_OBJECTIVE_ARCHETYPE[key] === archetype,
  );
  return keys.filter((key) => key !== "transfer_trader" || isTransferTraderAvailableForSeason(seasonId));
}

/**
 * Deterministische Auswahl EINES Standard-Bonusziels für einen Angebots-Slot (season/team/archetype/slot).
 * `transfer_trader` ist im Live-Pool vorerst ausgeschlossen: sein Fenster (Verkäufe S(n-1)+Käufe S(n)) zählt
 * aktuell nur im Sim-Runner korrekt, im interaktiven Übergang werden die Fenster-Transfers keiner Abrechnung
 * zugeordnet — bis das gefixt ist, wird das Ziel nicht live vergeben (Code + Tests bleiben erhalten).
 * Liefert null, wenn für den Archetyp kein Ziel verfügbar ist (Fallback auf Legacy-Sonderziel im Aufrufer).
 */
export function pickBonusObjective(
  seasonId: string,
  teamId: string,
  archetype: SponsorArchetype,
  slotIndex: number,
): SponsorBonusObjectiveKey | null {
  const keys = getAvailableBonusObjectiveKeys(archetype, seasonId).filter((key) => key !== "transfer_trader");
  if (keys.length === 0) {
    return null;
  }
  const index = Math.floor(getStableUnitHash(`${seasonId}:${teamId}:${archetype}:${slotIndex}:bonus-objective`) * keys.length);
  return keys[Math.min(keys.length - 1, index)] ?? keys[0]!;
}
