/**
 * Auto-tune organic progression when peak or league net delta is outside corridor.
 *
 * Usage:
 *   npx tsx scripts/long-run-auto-tune-organic.ts --save-id <id> [--season-id season-1]
 *   npx tsx scripts/long-run-auto-tune-organic.ts --save-id <id> --apply
 */
import fs from "node:fs";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import {
  computeOrganicRegressionScaleFactor,
  computeOrganicTrainingScaleFactor,
  computeSeasonOrganicProgressionMetrics,
  isLeagueNetDeltaOutsideCorridor,
  isPeakNetOutsideCorridor,
  ORGANIC_PEAK_NET_MAX,
  ORGANIC_PEAK_NET_MIN,
} from "@/lib/season/long-run-organic-progression-audit";
import {
  ORGANIC_BASE_REGRESSION_PER_ATTRIBUTE,
  ORGANIC_MARKET_VALUE_PRESSURE_RATE,
  ORGANIC_PERFORMANCE_SETPOINT_SCALE,
} from "@/lib/training/organic-season-progression";
import { TRAINING_SETPOINTS_BY_MODE } from "@/lib/training/training-mode-presentation";

const PROJECT_ROOT = path.resolve(__dirname, "..");
const TRAINING_MODE_FILE = path.join(PROJECT_ROOT, "lib/training/training-mode-presentation.ts");
const ORGANIC_FILE = path.join(PROJECT_ROOT, "lib/training/organic-season-progression.ts");

function argValue(flag: string) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function patchTrainingSetpoints(scale: number) {
  const source = fs.readFileSync(TRAINING_MODE_FILE, "utf8");
  const next = {
    leicht: round(TRAINING_SETPOINTS_BY_MODE.leicht * scale),
    mittel: round(TRAINING_SETPOINTS_BY_MODE.mittel * scale),
    hart: round(TRAINING_SETPOINTS_BY_MODE.hart * scale),
  };
  const updated = source.replace(
    /export const TRAINING_SETPOINTS_BY_MODE: Record<PlayerTrainingMode, number> = \{[\s\S]*?\};/,
    `export const TRAINING_SETPOINTS_BY_MODE: Record<PlayerTrainingMode, number> = {
  leicht: ${next.leicht},
  mittel: ${next.mittel},
  hart: ${next.hart},
};`,
  );
  if (updated === source) {
    throw new Error("Could not patch TRAINING_SETPOINTS_BY_MODE in training-mode-presentation.ts");
  }
  fs.writeFileSync(TRAINING_MODE_FILE, updated);
  return next;
}

function patchOrganicRegression(scale: number) {
  const source = fs.readFileSync(ORGANIC_FILE, "utf8");
  const nextRegression = round(ORGANIC_BASE_REGRESSION_PER_ATTRIBUTE * scale, 3);
  const nextPressure = round(ORGANIC_MARKET_VALUE_PRESSURE_RATE * scale, 4);
  let updated = source.replace(
    /export const ORGANIC_BASE_REGRESSION_PER_ATTRIBUTE = [\d.]+;/,
    `export const ORGANIC_BASE_REGRESSION_PER_ATTRIBUTE = ${nextRegression};`,
  );
  updated = updated.replace(
    /export const ORGANIC_MARKET_VALUE_PRESSURE_RATE = [\d.]+;/,
    `export const ORGANIC_MARKET_VALUE_PRESSURE_RATE = ${nextPressure};`,
  );
  if (updated === source) {
    throw new Error("Could not patch organic regression constants in organic-season-progression.ts");
  }
  fs.writeFileSync(ORGANIC_FILE, updated);
  return { regression: nextRegression, pressureRate: nextPressure };
}

async function main() {
  loadEnvConfig(PROJECT_ROOT);
  const saveId = argValue("--save-id");
  if (!saveId) throw new Error("Missing --save-id");

  const save = createPersistenceService().getSaveById(saveId);
  if (!save) throw new Error(`Save not found: ${saveId}`);

  const seasonId = argValue("--season-id") ?? save.gameState.season.id;
  const metrics = computeSeasonOrganicProgressionMetrics(save.gameState, seasonId);
  const apply = process.argv.includes("--apply");

  const peakOutside = isPeakNetOutsideCorridor(metrics.peakP90, metrics.playerCount);
  const leagueOutside = isLeagueNetDeltaOutsideCorridor(metrics.leagueNetAverage, metrics.playerCount);

  console.log(JSON.stringify({ seasonId, metrics, peakOutside, leagueOutside }, null, 2));

  if (!peakOutside && !leagueOutside) {
    console.log("Peak and league net delta within corridor — no tune needed.");
    return;
  }

  const trainingScale = peakOutside ? computeOrganicTrainingScaleFactor(metrics.peakP90) : null;
  const regressionScale = leagueOutside ? computeOrganicRegressionScaleFactor(metrics.leagueNetAverage) : null;

  if (trainingScale != null) {
    console.log(
      `Training scale: ${trainingScale} (peakP90=${metrics.peakP90}, target ~${(ORGANIC_PEAK_NET_MIN + ORGANIC_PEAK_NET_MAX) / 2})`,
    );
  }
  if (regressionScale != null) {
    console.log(`Regression scale: ${regressionScale} (liga-Ø=${metrics.leagueNetAverage})`);
  }

  if (!apply) {
    console.log("Dry-run only. Re-run with --apply to patch tuning files.");
    process.exit(1);
  }

  if (trainingScale != null) {
    const next = patchTrainingSetpoints(trainingScale);
    console.log(`Applied TRAINING_SETPOINTS_BY_MODE: leicht=${next.leicht}, mittel=${next.mittel}, hart=${next.hart}`);
  }
  if (regressionScale != null && regressionScale !== 1) {
    const next = patchOrganicRegression(regressionScale);
    console.log(
      `Applied organic regression: base=${next.regression}, pressureRate=${next.pressureRate} (performance scale=${ORGANIC_PERFORMANCE_SETPOINT_SCALE})`,
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
