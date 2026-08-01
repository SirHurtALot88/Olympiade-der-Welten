/**
 * training-source-share-audit.ts
 *
 * MESSSKRIPT (keine Balancing-Änderung): Misst, welchen Anteil die einzelnen
 * Entwicklungsquellen am Saison-Setpoint-Haushalt eines Spielers haben.
 *
 * Quellen (exakt die Terme, die `buildOrganicSeasonProgression` zurückgibt und
 * die sich zu `netSetpoints` addieren):
 *   - Training       = appliedTrainingSetpoints  (Klassen-Fokus-Verteilung des Trainingsbudgets)
 *   - Spillover      = spilloverSetpoints        (Nebenstat-Hilfe AUS dem Trainingsbudget)
 *   - Performance    = appliedPerformanceSetpoints (Spielleistungs-Budget aus den Matchday-Records)
 *   - Regression     = regressionBreakdown.combinedTotal (negativ: Flat + Marktwert-Druck)
 *
 * Es gibt KEINE weitere organische Quelle: das XP-System ist abgeschafft, die reale
 * Entwicklung läuft ausschließlich über obige vier Terme (siehe
 * lib/progression/season-end-xp-apply-service.ts).
 *
 * Kennzahlen:
 *   - Brutto        = Training + Spillover + Performance
 *   - Netto         = Brutto + Regression   (== netSetpoints vor Attribut-Clamping)
 *   - perfShareGross = Performance / Brutto  ("Wie viel vom Zuwachs kommt aus Leistung?")
 *   - Zwei Mittelungen: MAKRO (Σ über alle Spieler / Σ Brutto, „Anteil am Zuwachs")
 *     und MIKRO (arithm. Mittel der Spieler-Einzelanteile, „Anteil im Ø-Spieler").
 *
 * Aufruf:
 *   npm run training:source-share-audit -- --save-id <id> [--json]
 *   OLY_APP_SQLITE_PATH=/pfad/zur.sqlite npm run training:source-share-audit -- --save-id <id>
 */

import { loadEnvConfig } from "@next/env";

import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { getTeamFacilityState } from "@/lib/facilities/facility-effects";
import { buildPlayerRatingContractMap } from "@/lib/foundation/player-rating-contract";
import { buildPlayerSeasonPerformance } from "@/lib/foundation/player-season-performance";
import { buildPlayerProgressionForecast } from "@/lib/training/player-progression-forecast";
import {
  buildOrganicSeasonProgression,
  resolveSeasonTotalMatchdaysForProgression,
  resolveSeasonTrainingAccumulatorInputs,
} from "@/lib/training/organic-season-progression";
import { getProgressionRatingTier } from "@/lib/training/season-end-progression-preview";
import {
  ORGANIC_LEAGUE_NET_AVG_MAX,
  ORGANIC_LEAGUE_NET_AVG_MIN,
  ORGANIC_PEAK_NET_MAX,
  ORGANIC_PEAK_NET_MIN,
} from "@/lib/season/long-run-organic-progression-audit";
import type { Player } from "@/lib/data/olyDataTypes";

const PROJECT_ROOT = process.cwd();

function argValue(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

function hasFlag(flag: string) {
  return process.argv.includes(flag);
}

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function mean(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function stdDev(values: number[]) {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(values.reduce((sum, value) => sum + (value - m) ** 2, 0) / (values.length - 1));
}

function quantile(values: number[], q: number) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const pos = (sorted.length - 1) * q;
  const low = Math.floor(pos);
  const high = Math.ceil(pos);
  if (low === high) return sorted[low];
  return sorted[low] + (sorted[high] - sorted[low]) * (pos - low);
}

/**
 * Spiegelt `computeSeasonOrganicProgressionMetrics().peakP90` aus
 * lib/season/long-run-organic-progression-audit.ts 1:1 — die Kennzahl ist NICHT das P90 der
 * Gesamtverteilung, sondern das P90 innerhalb der zehn besten Netto-Werte (also faktisch der
 * zweitbeste Spieler der Liga). Nachgebaut statt importiert, weil die Original-Funktion die
 * bereits GEBUCHTEN Progression-Events braucht, die vor dem Saisonende-Apply noch nicht existieren.
 */
function peakP90OfTop10(netValues: number[]) {
  const sortedDesc = [...netValues].sort((left, right) => right - left);
  const top10 = sortedDesc.slice(0, 10);
  const positive = top10.filter((value) => value > 0);
  const sample = positive.length > 0 ? positive : top10;
  const asc = [...sample].sort((left, right) => left - right);
  if (asc.length === 0) return 0;
  return round(asc[Math.min(asc.length - 1, Math.ceil(asc.length * 0.9) - 1)]!, 2);
}

/**
 * Kehrt die Soft-Knee-Kurve aus `buildPerformanceDeltas` um (curved = knee + sqrt(raw − knee) × 1,25),
 * um sichtbar zu machen, wie viel Performance-Budget die Kurve oberhalb des Knies abschneidet.
 */
const PERFORMANCE_SEASON_SOFT_KNEE = 5.5;
function invertPerformanceSoftKnee(curved: number) {
  if (curved <= PERFORMANCE_SEASON_SOFT_KNEE) return round(curved, 2);
  return round(PERFORMANCE_SEASON_SOFT_KNEE + ((curved - PERFORMANCE_SEASON_SOFT_KNEE) / 1.25) ** 2, 2);
}

type PlayerRow = {
  playerId: string;
  name: string;
  teamId: string;
  rating: number;
  tier: string;
  appearances: number;
  trainingMode: string;
  marktwert: number;
  /** Performance-Budget der Saison NACH dem Soft-Knee (organic.performanceSetpoints). */
  performanceBudget: number;
  /** Rück-invertiertes Budget VOR dem Soft-Knee — zeigt, wie viel die Kurve abschneidet. */
  performanceBudgetRaw: number;
  training: number;
  spillover: number;
  performance: number;
  regression: number;
  gross: number;
  net: number;
  /** Netto nach Attribut-Clamping (Ceiling/1..99) — das real gebuchte Ergebnis. */
  netApplied: number;
  perfShareGross: number | null;
  trainingShareGross: number | null;
  spilloverShareGross: number | null;
  regressionRatio: number | null;
};

function summarize(label: string, rows: PlayerRow[]) {
  const sum = (pick: (row: PlayerRow) => number) => rows.reduce((total, row) => total + pick(row), 0);
  const grossTotal = sum((row) => row.gross);
  const perfShares = rows.map((row) => row.perfShareGross).filter((value): value is number => value != null);
  const trainShares = rows.map((row) => row.trainingShareGross).filter((value): value is number => value != null);
  const spillShares = rows.map((row) => row.spilloverShareGross).filter((value): value is number => value != null);
  const regRatios = rows.map((row) => row.regressionRatio).filter((value): value is number => value != null);
  return {
    label,
    players: rows.length,
    avgRating: round(mean(rows.map((row) => row.rating)), 1),
    avgAppearances: round(mean(rows.map((row) => row.appearances)), 1),
    // Absolute Setpoints (Ø je Spieler und Saison)
    avgTraining: round(mean(rows.map((row) => row.training)), 2),
    avgSpillover: round(mean(rows.map((row) => row.spillover)), 2),
    avgPerformance: round(mean(rows.map((row) => row.performance)), 2),
    avgRegression: round(mean(rows.map((row) => row.regression)), 2),
    avgPerformanceBudget: round(mean(rows.map((row) => row.performanceBudget)), 2),
    avgPerformanceBudgetRaw: round(mean(rows.map((row) => row.performanceBudgetRaw)), 2),
    shareAboveSoftKneePct: round(
      (rows.filter((row) => row.performanceBudget > PERFORMANCE_SEASON_SOFT_KNEE).length / Math.max(1, rows.length)) * 100,
      1,
    ),
    avgGross: round(mean(rows.map((row) => row.gross)), 2),
    avgNet: round(mean(rows.map((row) => row.net)), 2),
    avgNetApplied: round(mean(rows.map((row) => row.netApplied)), 2),
    // Offizieller Balancing-Korridor (lib/season/long-run-organic-progression-audit.ts) misst
    // an `netSetpoints` (nach Clamping) — daher hier dieselbe Größe.
    netAppliedMedian: round(quantile(rows.map((row) => row.netApplied), 0.5), 2),
    netAppliedP90: round(quantile(rows.map((row) => row.netApplied), 0.9), 2),
    /** Exakt die Peak-Kennzahl des Korridors: P90 INNERHALB der Top-10-Netto-Werte. */
    peakP90: peakP90OfTop10(rows.map((row) => row.netApplied)),
    peakMedianTop10: round(
      mean([...rows.map((row) => row.netApplied)].sort((left, right) => right - left).slice(0, 10)),
      2,
    ),
    // MAKRO-Anteile: Σ Quelle / Σ Brutto (Anteil am gesamten Zuwachs)
    macroPerfSharePct: grossTotal > 0 ? round((sum((row) => row.performance) / grossTotal) * 100, 1) : null,
    macroTrainingSharePct: grossTotal > 0 ? round((sum((row) => row.training) / grossTotal) * 100, 1) : null,
    macroSpilloverSharePct: grossTotal > 0 ? round((sum((row) => row.spillover) / grossTotal) * 100, 1) : null,
    // MIKRO-Anteile: Ø über die Spieler-Einzelanteile
    microPerfSharePct: round(mean(perfShares) * 100, 1),
    microPerfShareSdPct: round(stdDev(perfShares) * 100, 1),
    microPerfShareP10Pct: round(quantile(perfShares, 0.1) * 100, 1),
    microPerfShareMedianPct: round(quantile(perfShares, 0.5) * 100, 1),
    microPerfShareP90Pct: round(quantile(perfShares, 0.9) * 100, 1),
    microTrainingSharePct: round(mean(trainShares) * 100, 1),
    microSpilloverSharePct: round(mean(spillShares) * 100, 1),
    // Regression gegen Zuwachs
    macroRegressionRatioPct: grossTotal > 0 ? round((Math.abs(sum((row) => row.regression)) / grossTotal) * 100, 1) : null,
    microRegressionRatioPct: round(mean(regRatios) * 100, 1),
    microRegressionRatioSdPct: round(stdDev(regRatios) * 100, 1),
    shareNetNegativePct: round((rows.filter((row) => row.net < 0).length / Math.max(1, rows.length)) * 100, 1),
    shareRegressionEatsGrossPct: round(
      (rows.filter((row) => Math.abs(row.regression) > row.gross).length / Math.max(1, rows.length)) * 100,
      1,
    ),
  };
}

function pct(value: number | null) {
  return value == null ? "–" : `${value.toFixed(1)} %`;
}

async function main() {
  loadEnvConfig(PROJECT_ROOT);

  const persistence = createPersistenceService();
  const requestedSaveId = argValue("--save-id");
  const saveId = requestedSaveId ?? persistence.listSaves()[0]?.saveId;
  if (!saveId) throw new Error("Kein Save gefunden — --save-id angeben.");
  const save = persistence.getSaveById(saveId);
  if (!save) throw new Error(`Save nicht gefunden: ${saveId}`);

  const gameState = save.gameState;
  const playerById = new Map(gameState.players.map((player) => [player.id, player] as const));
  const ratings = buildPlayerRatingContractMap(gameState);
  const totalMatchdays = resolveSeasonTotalMatchdaysForProgression(gameState);
  const facilitiesByTeamId = new Map<string, ReturnType<typeof getTeamFacilityState>>();

  const rows: PlayerRow[] = [];
  const seen = new Set<string>();

  for (const rosterEntry of gameState.rosters) {
    if (seen.has(rosterEntry.playerId)) continue;
    seen.add(rosterEntry.playerId);
    const player = playerById.get(rosterEntry.playerId);
    if (!player) continue;

    if (!facilitiesByTeamId.has(rosterEntry.teamId)) {
      facilitiesByTeamId.set(rosterEntry.teamId, getTeamFacilityState(gameState, rosterEntry.teamId));
    }
    const facilities = facilitiesByTeamId.get(rosterEntry.teamId)!;
    const playerRating = ratings.get(player.id) ?? null;
    // Für die Gruppierung: normalisierter OVR aus der Rating-Contract-Zeile (Fallback player.rating).
    const ovr =
      playerRating != null && Number.isFinite(playerRating.ovrNormalized)
        ? (playerRating.ovrNormalized as number)
        : (player.rating ?? 0);
    const seasonPerformance = buildPlayerSeasonPerformance(gameState, player.id);

    // 1:1 wie der Saisonende-Apply (buildPreComputedSeasonXpMap): Accumulator-Overrides
    // + saisonale Entwicklungs-Route, KEIN regressionMatchdayScale (volle Saison-Regression).
    const routeForecast = buildPlayerProgressionForecast({
      gameState,
      player,
      playerRating,
      seasonPerformance,
      currentXP: player.currentXP ?? 0,
      spentXP: player.spentXP ?? 0,
      lifetimeXP: player.lifetimeXP ?? null,
    });
    const accumulatorOverrides =
      resolveSeasonTrainingAccumulatorInputs({
        accumulator: (player as Player).seasonTrainingAccumulator,
        seasonId: gameState.season.id,
        totalMatchdays,
      }) ?? {};

    const organic = buildOrganicSeasonProgression({
      gameState,
      player,
      facilities,
      ...accumulatorOverrides,
      route: routeForecast.developmentRoute,
    });

    const training = organic.appliedTrainingSetpoints;
    const spillover = organic.spilloverSetpoints;
    const performance = organic.appliedPerformanceSetpoints;
    const regression = organic.regressionBreakdown.combinedTotal;
    const gross = round(training + spillover + performance, 3);
    const net = round(gross + regression, 3);

    rows.push({
      playerId: player.id,
      name: player.name ?? player.id,
      teamId: rosterEntry.teamId,
      rating: ovr,
      tier: getProgressionRatingTier(ovr),
      appearances: seasonPerformance?.appearances ?? 0,
      trainingMode: organic.trainingMode,
      marktwert: organic.regressionBreakdown.marktwertBase,
      performanceBudget: organic.performanceSetpoints,
      performanceBudgetRaw: invertPerformanceSoftKnee(organic.performanceSetpoints),
      training,
      spillover,
      performance,
      regression,
      gross,
      net,
      netApplied: organic.netSetpoints,
      perfShareGross: gross > 0 ? performance / gross : null,
      trainingShareGross: gross > 0 ? training / gross : null,
      spilloverShareGross: gross > 0 ? spillover / gross : null,
      regressionRatio: gross > 0 ? Math.abs(regression) / gross : null,
    });
  }

  if (rows.length === 0) throw new Error("Keine Kaderspieler im Save gefunden.");

  // Stärke-Gruppen: Terzile über das Rating (robuster als feste Grenzen, da das
  // Rating-Niveau je Save schwankt) — zusätzlich die feste Tier-Skala.
  const sortedByRating = [...rows].sort((left, right) => left.rating - right.rating);
  const third = Math.floor(sortedByRating.length / 3);
  const weak = sortedByRating.slice(0, third);
  const mid = sortedByRating.slice(third, sortedByRating.length - third);
  const strong = sortedByRating.slice(sortedByRating.length - third);

  const overall = summarize("GESAMT", rows);
  const groups = [
    summarize("schwach (unteres Rating-Drittel)", weak),
    summarize("mittel", mid),
    summarize("stark (oberes Rating-Drittel)", strong),
  ];
  const played = rows.filter((row) => row.appearances > 0);
  const notPlayed = rows.filter((row) => row.appearances === 0);
  const byTier = [...new Set(rows.map((row) => row.tier))]
    .sort()
    .map((tier) => summarize(`Tier ${tier}`, rows.filter((row) => row.tier === tier)));

  const report = {
    saveId,
    saveName: save.name,
    seasonId: gameState.season.id,
    totalMatchdays,
    matchdaysPlayed: Math.max(
      0,
      ...rows.map((row) => (playerById.get(row.playerId) as Player | undefined)?.seasonTrainingAccumulator?.matchdaysCounted ?? 0),
    ),
    overall,
    groups,
    byTier,
    played: summarize("mit Einsätzen", played),
    notPlayed: summarize("ohne Einsatz", notPlayed),
  };

  if (hasFlag("--json")) {
    console.log(JSON.stringify({ ...report, rows }, null, 2));
    return;
  }

  const lines: string[] = [];
  lines.push(`# Trainings-Quellen-Anteile — ${save.name} (${saveId})`);
  lines.push(
    `Saison ${gameState.season.id} · ${report.matchdaysPlayed}/${totalMatchdays} Spieltage im Accumulator · ${rows.length} Kaderspieler`,
  );
  lines.push("");
  lines.push("Definition: Brutto = Training + Spillover + Performance. Netto = Brutto + Regression (negativ).");
  lines.push("MAKRO = Σ Quelle / Σ Brutto (Anteil am gesamten Zuwachs). MIKRO = Ø der Spieler-Einzelanteile.");
  lines.push("");

  const table = (entries: ReturnType<typeof summarize>[]) => {
    lines.push(
      "| Gruppe | n | Ø OVR | Ø Train | Ø Spill | Ø Perf | Ø Regr | Ø Brutto | Ø Netto | Perf% MAKRO | Perf% MIKRO | ±SD | P10 | Med | P90 | Regr/Brutto MAKRO | Netto<0 |",
    );
    lines.push("|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|");
    for (const entry of entries) {
      lines.push(
        `| ${entry.label} | ${entry.players} | ${entry.avgRating} | ${entry.avgTraining} | ${entry.avgSpillover} | ${entry.avgPerformance} | ${entry.avgRegression} | ${entry.avgGross} | ${entry.avgNet} | ${pct(entry.macroPerfSharePct)} | ${pct(entry.microPerfSharePct)} | ${entry.microPerfShareSdPct} | ${entry.microPerfShareP10Pct} | ${entry.microPerfShareMedianPct} | ${entry.microPerfShareP90Pct} | ${pct(entry.macroRegressionRatioPct)} | ${pct(entry.shareNetNegativePct)} |`,
      );
    }
  };

  table([overall, ...groups, report.played, report.notPlayed]);
  lines.push("");
  lines.push("## Nach fester Rating-Tier-Skala");
  table(report.byTier);

  // Regression gegen den offiziellen Korridor (lib/season/long-run-organic-progression-audit.ts).
  lines.push("");
  lines.push("## Regression gegen den offiziellen Balancing-Korridor");
  lines.push(
    `Maßstab: Liga-Ø Netto/Spieler ∈ [${ORGANIC_LEAGUE_NET_AVG_MIN}, ${ORGANIC_LEAGUE_NET_AVG_MAX}] · Peak-P90 ∈ [${ORGANIC_PEAK_NET_MIN}, ${ORGANIC_PEAK_NET_MAX}]`,
  );
  lines.push("");
  lines.push("| Gruppe | n | Ø Netto (gebucht) | Median | P90 (alle) | Regr/Brutto MAKRO | Netto<0 |");
  lines.push("|---|--:|--:|--:|--:|--:|--:|");
  for (const entry of [overall, ...groups, ...report.byTier]) {
    lines.push(
      `| ${entry.label} | ${entry.players} | ${entry.avgNetApplied} | ${entry.netAppliedMedian} | ${entry.netAppliedP90} | ${pct(entry.macroRegressionRatioPct)} | ${pct(entry.shareNetNegativePct)} |`,
    );
  }
  const leagueAvg = overall.avgNetApplied;
  const leagueVerdict =
    leagueAvg < ORGANIC_LEAGUE_NET_AVG_MIN
      ? "ROT — Regression zu hoch (Liga-Ø unter Korridor)"
      : leagueAvg > ORGANIC_LEAGUE_NET_AVG_MAX
        ? "ROT — Wachstum zu hoch (Liga-Ø über Korridor)"
        : "GRÜN — Liga-Ø im Korridor";
  const peakVerdict =
    overall.peakP90 < ORGANIC_PEAK_NET_MIN
      ? "ROT — Spitze zu flach"
      : overall.peakP90 > ORGANIC_PEAK_NET_MAX
        ? "ROT — Spitze zu steil"
        : "GRÜN — Spitze im Korridor";
  lines.push("");
  lines.push(`Liga-Ø Netto = ${leagueAvg} → ${leagueVerdict}`);
  lines.push(
    `Peak-P90 (Top-10-Kennzahl des Audits) = ${overall.peakP90} (Top-10-Median ${overall.peakMedianTop10}) → ${peakVerdict}`,
  );
  lines.push("");
  lines.push("## Quellen-Mix gesamt (MAKRO, Σ Quelle / Σ Brutto)");
  lines.push(
    `Training ${pct(overall.macroTrainingSharePct)} · Spillover ${pct(overall.macroSpilloverSharePct)} · Performance ${pct(overall.macroPerfSharePct)}`,
  );
  lines.push(
    `Performance-Anteil OHNE Spillover im Nenner (Performance / (Training + Performance)): ${pct(
      round(
        (overall.macroPerfSharePct! / (overall.macroPerfSharePct! + overall.macroTrainingSharePct!)) * 100,
        1,
      ),
    )}`,
  );
  lines.push(
    `Ø Performance-Budget nach Soft-Knee ${overall.avgPerformanceBudget} (vor Knee ${overall.avgPerformanceBudgetRaw}) · ${overall.shareAboveSoftKneePct} % der Spieler liegen über dem Knie (${PERFORMANCE_SEASON_SOFT_KNEE})`,
  );

  // Projektion: welche Faktoren bräuchte es für den Ziel-Anteil, OHNE den Brutto-Haushalt
  // (und damit den Liga-Ø-Netto) zu verschieben? Rein lineare Erste-Ordnung-Rechnung:
  // Soft-Knee, Ceiling-Clamps und Wachstums-Böden sind NICHT mitmodelliert — die Faktoren sind
  // ein Startwert für eine echte Iteration, keine fertige Balancing-Zahl.
  const targetShare = Number(argValue("--target-perf-share") ?? "0.5");
  const sumPerf = rows.reduce((total, row) => total + row.performance, 0);
  const sumTrain = rows.reduce((total, row) => total + row.training + row.spillover, 0);
  const sumGross = sumPerf + sumTrain;
  const perfFactor = (targetShare * sumGross) / sumPerf;
  const trainFactor = ((1 - targetShare) * sumGross) / sumTrain;
  lines.push("");
  lines.push(`## Projektion auf Ziel-Performance-Anteil ${round(targetShare * 100, 1)} % (Brutto konstant)`);
  lines.push(
    "Erste-Ordnung-Linearprojektion — Soft-Knee, Ceiling-Clamp und Wachstums-Böden sind NICHT modelliert.",
  );
  lines.push(
    `Performance × ${round(perfFactor, 3)} · Training(+Spillover) × ${round(trainFactor, 3)} → Liga-Ø Netto (vor Clamping) bleibt ${overall.avgNet}`,
  );
  lines.push("");
  lines.push("| Gruppe | n | Ø Netto heute (vor Clamping) | Ø Netto projiziert | Δ | Perf%-Anteil heute | projiziert |");
  lines.push("|---|--:|--:|--:|--:|--:|--:|");
  for (const entry of [overall, ...groups]) {
    const groupRows =
      entry.label === "GESAMT"
        ? rows
        : entry.label.startsWith("schwach")
          ? weak
          : entry.label === "mittel"
            ? mid
            : strong;
    const projPerf = groupRows.reduce((total, row) => total + row.performance * perfFactor, 0);
    const projTrain = groupRows.reduce((total, row) => total + (row.training + row.spillover) * trainFactor, 0);
    const projReg = groupRows.reduce((total, row) => total + row.regression, 0);
    const n = Math.max(1, groupRows.length);
    const projNet = round((projPerf + projTrain + projReg) / n, 2);
    lines.push(
      `| ${entry.label} | ${entry.players} | ${entry.avgNet} | ${projNet} | ${round(projNet - entry.avgNet, 2)} | ${pct(entry.macroPerfSharePct)} | ${pct(round((projPerf / (projPerf + projTrain)) * 100, 1))} |`,
    );
  }

  console.log(lines.join("\n"));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
