export const DEVELOPMENT_POINTS_PER_LEVEL = 5;
export const DEVELOPMENT_BASE_XP_PER_LEVEL = 160;
export const DEVELOPMENT_XP_LEVEL_STEP = 40;
export const DEVELOPMENT_MAX_LEVEL_UPS_PER_SEASON = 2;
export const DEVELOPMENT_TARGET_TOP_SEASON_LEVEL_GAIN = 1.5;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function normalizeLevel(level: number | null | undefined) {
  return Math.max(1, Math.floor(Number.isFinite(level ?? NaN) ? (level as number) : 1));
}

export function getDevelopmentXpForLevel(level: number | null | undefined) {
  const normalized = normalizeLevel(level);
  return DEVELOPMENT_BASE_XP_PER_LEVEL + (normalized - 1) * DEVELOPMENT_XP_LEVEL_STEP;
}

export function getDevelopmentXpForLevelGain(startLevel: number, levelGain: number) {
  let remainingGain = Math.max(0, levelGain);
  let level = normalizeLevel(startLevel);
  let xp = 0;

  while (remainingGain > 0) {
    const step = Math.min(1, remainingGain);
    xp += getDevelopmentXpForLevel(level) * step;
    remainingGain -= step;
    level += 1;
  }

  return Math.round(xp);
}

export function getDevelopmentLevelProgress(lifetimeXp: number | null | undefined) {
  let remainingXp = Math.max(0, Math.floor(Number.isFinite(lifetimeXp ?? NaN) ? (lifetimeXp as number) : 0));
  let developmentLevel = 1;
  let xpForCurrentLevel = getDevelopmentXpForLevel(developmentLevel);

  while (remainingXp >= xpForCurrentLevel) {
    remainingXp -= xpForCurrentLevel;
    developmentLevel += 1;
    xpForCurrentLevel = getDevelopmentXpForLevel(developmentLevel);
  }

  return {
    developmentLevel,
    progressXp: remainingXp,
    xpForCurrentLevel,
    xpToNextLevel: xpForCurrentLevel - remainingXp,
    progressPct: Number(clamp((remainingXp / xpForCurrentLevel) * 100, 0, 100).toFixed(1)),
  };
}

export function getDevelopmentLevelUpsFromXp(input: {
  startLevel: number;
  availableXp: number;
  maxLevelUps?: number;
}) {
  let remainingXp = Math.max(0, Math.floor(input.availableXp));
  let level = normalizeLevel(input.startLevel);
  const maxLevelUps = Math.max(0, Math.floor(input.maxLevelUps ?? Number.POSITIVE_INFINITY));
  let levelUps = 0;

  while (levelUps < maxLevelUps) {
    const cost = getDevelopmentXpForLevel(level);
    if (remainingXp < cost) break;
    remainingXp -= cost;
    levelUps += 1;
    level += 1;
  }

  return {
    levelUps,
    remainingXp,
    nextLevelCost: getDevelopmentXpForLevel(level),
  };
}
