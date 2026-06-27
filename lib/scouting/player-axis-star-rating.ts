import type { Discipline, GameState, Player } from "@/lib/data/olyDataTypes";

// Per-gameState caches so that O(n)-over-all-players work is only done once per distinct state.
const leagueAxisValuesCache = new WeakMap<GameState, Record<PlayerAxisKey, number[]>>();
const leagueDisciplineRanksCache = new WeakMap<GameState, Map<string, Map<string, number>>>();

export type PlayerAxisKey = "pow" | "spe" | "men" | "soc";

export type PlayerDisciplineStarTag = {
  disciplineId: string;
  disciplineName: string;
  stars: number;
  leagueRank: number;
};

export type PlayerAxisStarProfile = {
  pow: number;
  spe: number;
  men: number;
  soc: number;
  overall: number;
  disciplineTags: PlayerDisciplineStarTag[];
};

export type RevealedAxisStarProfile = {
  pow: number | null;
  spe: number | null;
  men: number | null;
  soc: number | null;
  overall: number | null;
  overallBand: "weak" | "solid" | "strong" | null;
  disciplineTags: PlayerDisciplineStarTag[];
  displayLabel: string;
};

const AXIS_KEYS: PlayerAxisKey[] = ["pow", "spe", "men", "soc"];

const CATEGORY_TO_AXIS: Record<string, PlayerAxisKey> = {
  power: "pow",
  speed: "spe",
  mental: "men",
  social: "soc",
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function roundHalfStar(value: number) {
  return clamp(Math.round(value * 2) / 2, 0.5, 5);
}

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function getAxisValue(player: Player, axis: PlayerAxisKey) {
  const value = player.coreStats?.[axis];
  return isFiniteNumber(value) ? value : null;
}

function percentileOf(value: number, sortedValues: number[]) {
  if (sortedValues.length === 0) {
    return 50;
  }
  let below = 0;
  for (const entry of sortedValues) {
    if (entry < value) below += 1;
  }
  return (below / sortedValues.length) * 100;
}

/**
 * Maps league percentile → half-star CA rating.
 * Bands are intentionally slightly asymmetric so bucket counts don't look
 * mathematically perfect. Bottom ~3 % → 0.5★ (Ersatzspieler).
 */
export function percentileToCurrentAbilityStars(percentile: number) {
  if (percentile >= 92) return roundHalfStar(4.5 + (percentile - 92) / 16);
  if (percentile >= 73) return roundHalfStar(3.5 + (percentile - 73) / 19);
  if (percentile >= 47) return roundHalfStar(3 + (percentile - 47) / 52);
  if (percentile >= 21) return roundHalfStar(2.5 + (percentile - 21) / 52);
  if (percentile >= 8) return roundHalfStar(1.5 + (percentile - 8) / 26);
  if (percentile >= 3) return roundHalfStar(1 + (percentile - 3) / 10);
  return 0.5;
}

/** Stable 0..1 hash from player id — used for deterministic score fingerprinting. */
function hashPlayerId(playerId: string): number {
  let h = 2166136261;
  for (let i = 0; i < playerId.length; i++) {
    h ^= playerId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

function buildLeagueAxisValues(gameState: GameState): Record<PlayerAxisKey, number[]> {
  const cached = leagueAxisValuesCache.get(gameState);
  if (cached) return cached;
  const values: Record<PlayerAxisKey, number[]> = { pow: [], spe: [], men: [], soc: [] };
  for (const player of gameState.players) {
    for (const axis of AXIS_KEYS) {
      const value = getAxisValue(player, axis);
      if (value != null) values[axis].push(value);
    }
  }
  for (const axis of AXIS_KEYS) {
    values[axis].sort((left, right) => left - right);
  }
  leagueAxisValuesCache.set(gameState, values);
  return values;
}

function buildLeagueDisciplineRanks(gameState: GameState, disciplines: Discipline[]): Map<string, Map<string, number>> {
  const cached = leagueDisciplineRanksCache.get(gameState);
  if (cached) return cached;
  const ranksByPlayer = new Map<string, Map<string, number>>();
  for (const discipline of disciplines) {
    const scored = gameState.players
      .map((player) => ({
        playerId: player.id,
        score: player.disciplineRatings?.[discipline.id] ?? null,
      }))
      .filter((entry): entry is { playerId: string; score: number } => isFiniteNumber(entry.score))
      .sort((left, right) => right.score - left.score);
    scored.forEach((entry, index) => {
      const playerRanks = ranksByPlayer.get(entry.playerId) ?? new Map<string, number>();
      playerRanks.set(discipline.id, index + 1);
      ranksByPlayer.set(entry.playerId, playerRanks);
    });
  }
  leagueDisciplineRanksCache.set(gameState, ranksByPlayer);
  return ranksByPlayer;
}

function getAxisMedian(sortedValues: number[]) {
  if (sortedValues.length === 0) return 50;
  const mid = Math.floor(sortedValues.length / 2);
  return sortedValues.length % 2 === 0
    ? (sortedValues[mid - 1]! + sortedValues[mid]!) / 2
    : sortedValues[mid]!;
}

function applyDisciplineSpecialistBonus(input: {
  axis: PlayerAxisKey;
  axisValue: number;
  axisMedian: number;
  disciplines: Discipline[];
  player: Player;
  leagueRanks: Map<string, number>;
}) {
  const axisDisciplines = input.disciplines.filter(
    (discipline) => CATEGORY_TO_AXIS[discipline.category] === input.axis,
  );
  const ranks = axisDisciplines
    .map((discipline) => input.leagueRanks.get(discipline.id) ?? null)
    .filter((rank): rank is number => rank != null);
  const eliteCount = ranks.filter((rank) => rank <= 3).length;
  const strongCount = ranks.filter((rank) => rank <= 20).length;
  if (eliteCount >= 1) return 0.5;
  if (strongCount >= 2 && input.axisValue >= input.axisMedian) return 0.5;
  return 0;
}

function getClassAxisWeights(className: string | null | undefined): Record<PlayerAxisKey, number> {
  const normalized = (className ?? "").toLowerCase();
  if (normalized.includes("charger") || normalized.includes("warrior") || normalized.includes("tank")) {
    return { pow: 0.45, spe: 0.2, men: 0.2, soc: 0.15 };
  }
  if (normalized.includes("runner") || normalized.includes("scout") || normalized.includes("speed")) {
    return { pow: 0.15, spe: 0.45, men: 0.2, soc: 0.2 };
  }
  if (normalized.includes("teacher") || normalized.includes("scholar") || normalized.includes("tactician")) {
    return { pow: 0.15, spe: 0.15, men: 0.45, soc: 0.25 };
  }
  if (normalized.includes("bard") || normalized.includes("charmer") || normalized.includes("diplomat")) {
    return { pow: 0.1, spe: 0.15, men: 0.25, soc: 0.5 };
  }
  return { pow: 0.25, spe: 0.25, men: 0.25, soc: 0.25 };
}

function buildDisciplineTags(input: {
  player: Player;
  disciplines: Discipline[];
  leagueRanks: Map<string, number>;
  leagueAxisValues: Record<PlayerAxisKey, number[]>;
}) {
  return input.disciplines
    .map((discipline) => {
      const score = input.player.disciplineRatings?.[discipline.id];
      const leagueRank = input.leagueRanks.get(discipline.id);
      if (!isFiniteNumber(score) || leagueRank == null) return null;
      const axis = CATEGORY_TO_AXIS[discipline.category] ?? "pow";
      const percentile = percentileOf(score, input.leagueAxisValues[axis]);
      return {
        disciplineId: discipline.id,
        disciplineName: discipline.name,
        stars: percentileToCurrentAbilityStars(percentile),
        leagueRank,
      };
    })
    .filter((entry): entry is PlayerDisciplineStarTag => entry != null)
    .sort((left, right) => left.leagueRank - right.leagueRank)
    .slice(0, 5);
}

/**
 * Computes a "specialist score" from raw axis values — the same formula used
 * for overall ranking, applied to raw numbers (not star-converted).
 * Best axis dominates; depth bonus rewards all-rounders.
 */
function computeSpecialistScore(values: number[]): number {
  const sorted = [...values].filter(isFiniteNumber).sort((a, b) => b - a);
  while (sorted.length < 4) sorted.push(0);
  return (
    (sorted[0] ?? 0) * 0.45 +
    (sorted[1] ?? 0) * 0.30 +
    (sorted[2] ?? 0) * 0.15 +
    (sorted[3] ?? 0) * 0.10 +
    (sorted[3] ?? 0) * 0.10 // depth bonus
  );
}

/**
 * Tiny deterministic offset per player so identical raw scores don't produce
 * perfectly uniform percentile buckets (breaks the "too clean" look).
 */
function specialistScoreFingerprint(playerId: string, scoreSpread: number): number {
  if (scoreSpread <= 0) return 0;
  return (hashPlayerId(playerId) - 0.5) * scoreSpread * 0.012;
}

/** Builds a sorted array of specialist scores for all players in the league. */
function buildLeagueSpecialistScores(gameState: GameState, scoreSpread: number): number[] {
  return gameState.players
    .map((player) => {
      const base = computeSpecialistScore(Object.values(player.coreStats ?? {}));
      return base + specialistScoreFingerprint(player.id, scoreSpread);
    })
    .filter(isFiniteNumber)
    .sort((a, b) => a - b);
}

/** Drag overall down when a player is genuinely awful in at least one axis. */
function applyWeakAxisOverallPenalty(input: {
  overall: number;
  player: Player;
  leagueAxisValues: Record<PlayerAxisKey, number[]>;
}): number {
  const axisPercentiles = AXIS_KEYS.map((axis) => {
    const value = getAxisValue(input.player, axis);
    if (value == null) return 100;
    return percentileOf(value, input.leagueAxisValues[axis]);
  });
  const weakestPct = Math.min(...axisPercentiles);
  let penalty = 0;
  if (weakestPct < 4) penalty = 1.0;
  else if (weakestPct < 10) penalty = 0.5;
  return roundHalfStar(clamp(input.overall - penalty, 0.5, 5));
}

export function buildPlayerAxisStarProfile(input: {
  gameState: GameState;
  player: Player;
  disciplines?: Discipline[];
}): PlayerAxisStarProfile {
  const disciplines = input.disciplines ?? input.gameState.disciplines;
  const leagueAxisValues = buildLeagueAxisValues(input.gameState);
  const leagueRanksByPlayer = buildLeagueDisciplineRanks(input.gameState, disciplines);
  const leagueRanks = leagueRanksByPlayer.get(input.player.id) ?? new Map<string, number>();
  const axisStars = {} as Record<PlayerAxisKey, number>;

  for (const axis of AXIS_KEYS) {
    const value = getAxisValue(input.player, axis);
    const sorted = leagueAxisValues[axis];
    const baseStars =
      value == null ? 2.5 : percentileToCurrentAbilityStars(percentileOf(value, sorted));
    const bonus = applyDisciplineSpecialistBonus({
      axis,
      axisValue: value ?? 0,
      axisMedian: getAxisMedian(sorted),
      disciplines,
      player: input.player,
      leagueRanks,
    });
    axisStars[axis] = roundHalfStar(baseStars + bonus);
  }

  // Overall = percentile of this player's specialist score in the full league.
  // Fingerprint jitter + weak-axis penalty break the overly uniform percentile look.
  const rawSpecialistScores = input.gameState.players
    .map((p) => computeSpecialistScore(Object.values(p.coreStats ?? {})))
    .filter(isFiniteNumber)
    .sort((a, b) => a - b);
  const scoreSpread =
    rawSpecialistScores.length > 0
      ? rawSpecialistScores[rawSpecialistScores.length - 1]! - rawSpecialistScores[0]!
      : 0;
  const leagueSpecialistScores = buildLeagueSpecialistScores(input.gameState, scoreSpread);
  const playerSpecialistScore =
    computeSpecialistScore(Object.values(input.player.coreStats ?? {})) +
    specialistScoreFingerprint(input.player.id, scoreSpread);
  const overallPercentile =
    leagueSpecialistScores.length > 0
      ? percentileOf(playerSpecialistScore, leagueSpecialistScores)
      : 50;
  const overall = applyWeakAxisOverallPenalty({
    overall: roundHalfStar(percentileToCurrentAbilityStars(overallPercentile)),
    player: input.player,
    leagueAxisValues,
  });

  return {
    pow: axisStars.pow,
    spe: axisStars.spe,
    men: axisStars.men,
    soc: axisStars.soc,
    overall,
    disciplineTags: buildDisciplineTags({
      player: input.player,
      disciplines,
      leagueRanks,
      leagueAxisValues,
    }),
  };
}

function blurStar(value: number, radius: number) {
  if (radius <= 0) return roundHalfStar(value);
  const direction = Math.round(value * 2) % 2 === 0 ? -radius : radius;
  return roundHalfStar(clamp(value + direction, 0.5, 5));
}

function formatHalfStars(value: number) {
  const full = Math.floor(value);
  const half = value - full >= 0.5 ? "½" : "";
  return `${"★".repeat(full)}${half}`.padEnd(full + (half ? 1 : 0), "☆") || "☆";
}

function formatAxisStarLine(profile: RevealedAxisStarProfile) {
  const parts: string[] = [];
  if (profile.pow != null) parts.push(`POW ${formatHalfStars(profile.pow)}`);
  if (profile.spe != null) parts.push(`SPE ${formatHalfStars(profile.spe)}`);
  if (profile.men != null) parts.push(`MEN ${formatHalfStars(profile.men)}`);
  if (profile.soc != null) parts.push(`SOC ${formatHalfStars(profile.soc)}`);
  if (parts.length === 0 && profile.overall != null) {
    return `Overall ${formatHalfStars(profile.overall)}`;
  }
  return parts.join(" · ");
}

export function revealAxisStarProfile(input: {
  profile: PlayerAxisStarProfile;
  scoutingLevel: number;
}): RevealedAxisStarProfile {
  const level = clamp(Math.round(input.scoutingLevel), 0, 5);
  if (level <= 0) {
    return {
      pow: null,
      spe: null,
      men: null,
      soc: null,
      overall: null,
      overallBand: null,
      disciplineTags: [],
      displayLabel: "Scouting nötig",
    };
  }

  if (level === 1) {
    const band =
      input.profile.overall >= 3.5 ? "strong" : input.profile.overall >= 2.5 ? "solid" : "weak";
    return {
      pow: null,
      spe: null,
      men: null,
      soc: null,
      overall: null,
      overallBand: band,
      disciplineTags: [],
      displayLabel: band === "strong" ? "Stark" : band === "solid" ? "Solide" : "Schwach",
    };
  }

  if (level === 2) {
    const blurred = roundHalfStar(input.profile.overall);
    return {
      pow: null,
      spe: null,
      men: null,
      soc: null,
      overall: blurred,
      overallBand: null,
      disciplineTags: [],
      displayLabel: `Overall ~${blurred}★`,
    };
  }

  const blur = level >= 4 ? 0 : 0.5;
  const revealed = {
    pow: blurStar(input.profile.pow, blur),
    spe: blurStar(input.profile.spe, blur),
    men: blurStar(input.profile.men, blur),
    soc: blurStar(input.profile.soc, blur),
    overall: level >= 3 ? roundHalfStar(input.profile.overall) : null,
    overallBand: null as RevealedAxisStarProfile["overallBand"],
    disciplineTags: level >= 4 ? input.profile.disciplineTags.slice(0, 3) : [],
    displayLabel: "",
  };
  revealed.displayLabel = formatAxisStarLine(revealed);
  if (level >= 5) {
    revealed.pow = input.profile.pow;
    revealed.spe = input.profile.spe;
    revealed.men = input.profile.men;
    revealed.soc = input.profile.soc;
    revealed.overall = input.profile.overall;
    revealed.disciplineTags = input.profile.disciplineTags.slice(0, 5);
    revealed.displayLabel = formatAxisStarLine(revealed);
  }
  return revealed;
}

export function formatStarValue(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value}★`;
}
