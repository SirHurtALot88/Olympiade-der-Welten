import type { SeasonEconomyFactorRecord, SeasonState } from "@/lib/data/olyDataTypes";

export const SEASON_ECONOMY_FACTOR_WINDOW_SIZE = 5;

/**
 * Uniform shift added to BOTH the default per-season pattern AND the random roll range (both ends), so the
 * whole salary-factor distribution can be raised/lowered with one knob. Default 0 (neutral, owner decision):
 * the salary factor must stay THE dominant payout scaler without an artificial upward drift. A same-seed A/B
 * had previously shown shift 0.1 makes the whole league MW+Cash ~+10% richer per season with the top/bottom
 * gap essentially unchanged (peak Schere 1.87 vs 1.84, <2.0) — but that lift COMPOUNDS across seasons, so it
 * was removed to avoid multi-season inflation. Set OLY_SALARY_FACTOR_SHIFT=0.1 to restore the upward-trending
 * pattern; keep any value modest because it compounds.
 */
const SALARY_FACTOR_SHIFT = Number(process.env.OLY_SALARY_FACTOR_SHIFT ?? 0) || 0;
/** Random roll range for future (beyond-default-window) seasons, both ends shiftable via SALARY_FACTOR_SHIFT. */
const SALARY_FACTOR_ROLL_MIN = 0.82 + SALARY_FACTOR_SHIFT;
const SALARY_FACTOR_ROLL_WIDTH = 0.42;

const DEFAULT_SEASON_FACTOR_VALUES = [1.09, 1.21, 1.16, 0.97, 0.9].map(
  (value) => Math.round((value + SALARY_FACTOR_SHIFT) * 100) / 100,
);

type SheetFactorInput = {
  seasonLabel: string;
  factor: number | null;
};

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function parseSeasonNumber(seasonId: string) {
  const parsed = Number(seasonId.match(/(\d+)$/)?.[1] ?? 1);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function getHorizonLabel(horizonIndex: number) {
  return horizonIndex === 0 ? "Aktuell" : `Season +${horizonIndex}`;
}

function hashToUint(input: string) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createSeededRandom(seed: string) {
  let state = hashToUint(seed) || 1;
  return () => {
    state = Math.imul(state ^ (state >>> 15), 1 | state);
    state ^= state + Math.imul(state ^ (state >>> 7), 61 | state);
    return ((state ^ (state >>> 14)) >>> 0) / 4294967296;
  };
}

function rollFutureSeasonFactor(seed: string) {
  const random = createSeededRandom(seed);
  return round2(SALARY_FACTOR_ROLL_MIN + random() * SALARY_FACTOR_ROLL_WIDTH);
}

function normalizeSheetFactors(sheetFactors?: SheetFactorInput[]) {
  const values = (sheetFactors ?? [])
    .map((entry) => (typeof entry.factor === "number" && Number.isFinite(entry.factor) ? round2(entry.factor) : null))
    .filter((value): value is number => value != null);

  return values.length > 0 ? values : DEFAULT_SEASON_FACTOR_VALUES;
}

/**
 * Reads OLY_LONG_RUN_SALARY_FACTOR_PATTERN, e.g. "1.18,1.15,0.85,0.85,0.88" for Season 1-5.
 * Used only for the initial (Season 1, unseeded) window so balancing runs can deterministically
 * script "N good seasons then M bad seasons" scenarios instead of relying on the randomized/default
 * factor rolls. The window then shifts season-by-season via advanceSeasonEconomyFactorWindow as usual.
 */
export function parseSalaryFactorPatternEnv(): number[] | null {
  const raw = process.env.OLY_LONG_RUN_SALARY_FACTOR_PATTERN;
  if (!raw || !raw.trim()) return null;
  const values = raw
    .split(",")
    .map((entry) => Number(entry.trim()))
    .filter((value) => Number.isFinite(value) && value > 0);
  return values.length > 0 ? values.map(round2) : null;
}

function buildSeedWindow(input: {
  saveId: string;
  seasonId: string;
  sheetFactors?: SheetFactorInput[];
  generatedAt?: string;
}) {
  const baseFactors = normalizeSheetFactors(input.sheetFactors);
  const seasonOffset = parseSeasonNumber(input.seasonId) - 1;
  const generatedAt = input.generatedAt ?? new Date().toISOString();

  return Array.from({ length: SEASON_ECONOMY_FACTOR_WINDOW_SIZE }, (_, horizonIndex) => {
    const absoluteIndex = seasonOffset + horizonIndex;
    const seededFactor = baseFactors[absoluteIndex];
    const rollSeed = `${input.saveId}:${input.seasonId}:season-economy-factor:${absoluteIndex + 1}`;
    return {
      seasonId: input.seasonId,
      seasonLabel: getHorizonLabel(horizonIndex),
      horizonIndex,
      factor: seededFactor != null ? seededFactor : rollFutureSeasonFactor(rollSeed),
      source: seededFactor != null ? "sheet_seed" : "rolled",
      rollSeed: seededFactor != null ? null : rollSeed,
      carriedFromSeasonId: null,
      generatedAt,
    } satisfies SeasonEconomyFactorRecord;
  });
}

function normalizeWindow(records: SeasonEconomyFactorRecord[], seasonId: string) {
  return records
    .filter((record) => record.seasonId === seasonId)
    .sort((left, right) => left.horizonIndex - right.horizonIndex)
    .slice(0, SEASON_ECONOMY_FACTOR_WINDOW_SIZE)
    .map((record, horizonIndex) => ({
      ...record,
      seasonLabel: getHorizonLabel(horizonIndex),
      horizonIndex,
      factor: round2(record.factor),
    }));
}

export function getSeasonEconomyFactorWindow(input: {
  saveId: string;
  seasonId: string;
  seasonState?: Pick<SeasonState, "seasonEconomyFactors">;
  sheetFactors?: SheetFactorInput[];
}) {
  const existingWindow = normalizeWindow(input.seasonState?.seasonEconomyFactors ?? [], input.seasonId);
  if (existingWindow.length === SEASON_ECONOMY_FACTOR_WINDOW_SIZE) {
    return existingWindow;
  }

  return buildSeedWindow(input);
}

export function advanceSeasonEconomyFactorWindow(input: {
  saveId: string;
  fromSeasonId: string;
  toSeasonId: string;
  seasonState?: Pick<SeasonState, "seasonEconomyFactors">;
  // 2026-07-04: lets a scripted multi-season pattern (see parseSalaryFactorPatternEnv) reach beyond
  // the initial 5-value seed window. Without this, only the first SEASON_ECONOMY_FACTOR_WINDOW_SIZE
  // (5) pattern values were ever consumed (buildSeedWindow only runs once, at season-1, and slices
  // to a 5-length window) — any pattern entries beyond index 4 were silently dropped and every later
  // season's factor fell back to a deterministic-but-uncontrolled random roll instead of the
  // caller's intended value. Passing the same pattern array on every advance call lets a 10 (or
  // longer) season pattern stay in full effect for the whole run.
  patternFactors?: number[] | null;
}) {
  const now = new Date().toISOString();
  const currentWindow = getSeasonEconomyFactorWindow({
    saveId: input.saveId,
    seasonId: input.fromSeasonId,
    seasonState: input.seasonState,
  });
  const newRollSeed = `${input.saveId}:${input.toSeasonId}:season-economy-factor:new-s-plus-4`;
  // The newly-revealed horizon+4 slot corresponds to absolute season number
  // parseSeasonNumber(toSeasonId) + (WINDOW_SIZE - 1), i.e. 0-based index into patternFactors.
  const newSlotAbsoluteIndex = parseSeasonNumber(input.toSeasonId) - 1 + (SEASON_ECONOMY_FACTOR_WINDOW_SIZE - 1);
  const patternValueForNewSlot = input.patternFactors?.[newSlotAbsoluteIndex];
  const hasPatternValue = typeof patternValueForNewSlot === "number" && Number.isFinite(patternValueForNewSlot);
  const nextWindow: SeasonEconomyFactorRecord[] = Array.from({ length: SEASON_ECONOMY_FACTOR_WINDOW_SIZE }, (_, horizonIndex) => {
    const carried = currentWindow[horizonIndex + 1] ?? null;
    if (carried) {
      return {
        ...carried,
        seasonId: input.toSeasonId,
        seasonLabel: getHorizonLabel(horizonIndex),
        horizonIndex,
        source: carried.source === "rolled" ? "rolled" : "carried",
        carriedFromSeasonId: input.fromSeasonId,
        generatedAt: now,
      };
    }

    return {
      seasonId: input.toSeasonId,
      seasonLabel: getHorizonLabel(horizonIndex),
      horizonIndex,
      factor: hasPatternValue ? round2(patternValueForNewSlot) : rollFutureSeasonFactor(newRollSeed),
      source: hasPatternValue ? "sheet_seed" : "rolled",
      rollSeed: hasPatternValue ? null : newRollSeed,
      carriedFromSeasonId: input.fromSeasonId,
      generatedAt: now,
    };
  });

  return {
    previousWindow: currentWindow,
    nextWindow,
    rerolledSeasonPlus4: nextWindow[SEASON_ECONOMY_FACTOR_WINDOW_SIZE - 1],
  };
}
