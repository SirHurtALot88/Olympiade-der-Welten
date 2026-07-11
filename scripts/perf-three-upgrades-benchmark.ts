import { createPersistenceService } from "@/lib/persistence/persistence-service";

const BASE_URL = process.env.PERF_BASE_URL ?? "http://localhost:3000";
const ITERATIONS = 5;

type TimedResult = {
  label: string;
  samplesMs: number[];
  medianMs: number;
  p95Ms: number;
  ok: boolean;
  detail?: string;
};

function percentile(sorted: number[], p: number) {
  if (sorted.length === 0) {
    return 0;
  }
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, index)] ?? 0;
}

function summarize(label: string, samplesMs: number[], ok = true, detail?: string): TimedResult {
  const sorted = [...samplesMs].sort((left, right) => left - right);
  return {
    label,
    samplesMs: sorted.map((value) => Math.round(value)),
    medianMs: Math.round(percentile(sorted, 50)),
    p95Ms: Math.round(percentile(sorted, 95)),
    ok,
    detail,
  };
}

async function timedFetch(url: string, init?: RequestInit) {
  const startedAt = performance.now();
  const response = await fetch(url, { cache: "no-store", ...init });
  const elapsedMs = performance.now() - startedAt;
  const text = await response.text();
  return { response, elapsedMs, text };
}

async function benchmarkHttp(label: string, url: string, init?: RequestInit) {
  const samples: number[] = [];
  let ok = true;
  let detail = "";

  for (let index = 0; index < ITERATIONS; index += 1) {
    const { response, elapsedMs, text } = await timedFetch(url, init);
    samples.push(elapsedMs);
    if (!response.ok) {
      ok = false;
      detail = `${response.status} ${text.slice(0, 180)}`;
      break;
    }
  }

  return summarize(label, samples, ok, detail);
}

async function main() {
  const persistence = createPersistenceService();
  const active = persistence.getActiveSave() ?? persistence.bootstrapSingleplayerSave().save;
  const saveId = active.saveId;
  const seasonId = active.gameState.season.id;
  const matchdayId = active.gameState.matchdayState.matchdayId;
  const teamId = active.gameState.teams[0]?.teamId ?? "";

  const versionSamples: number[] = [];
  for (let index = 0; index < ITERATIONS; index += 1) {
    const startedAt = performance.now();
    const versionMeta = persistence.getSaveVersionMetadata(saveId);
    versionSamples.push(performance.now() - startedAt);
    if (!versionMeta) {
      throw new Error("getSaveVersionMetadata returned null");
    }
  }

  const query = new URLSearchParams({
    saveId,
    seasonId,
    matchdayId,
    teamId,
    source: "sqlite",
  });

  const arenaBundleUrl = `${BASE_URL}/api/matchday/arena-base?${query.toString()}`;
  const labContextUrl = `${BASE_URL}/api/lineups/legacy/lab-context?${query.toString()}`;

  const results: TimedResult[] = [
    summarize("in-process getSaveVersionMetadata", versionSamples),
    await benchmarkHttp("GET /api/singleplayer-state/version", `${BASE_URL}/api/singleplayer-state/version?saveId=${encodeURIComponent(saveId)}`),
    await benchmarkHttp(
      "GET /api/singleplayer-state compact-initial",
      `${BASE_URL}/api/singleplayer-state?saveId=${encodeURIComponent(saveId)}&compact=foundation-initial`,
    ),
    await benchmarkHttp("GET /api/matchday/arena-base (bundle)", arenaBundleUrl),
  ];

  const dualSamples: number[] = [];
  let dualOk = true;
  let dualDetail = "";
  for (let index = 0; index < ITERATIONS; index += 1) {
    const startedAt = performance.now();
    const [contextResult, scoreResult] = await Promise.all([
      fetch(labContextUrl, { cache: "no-store" }),
      fetch(`${BASE_URL}/api/season/matchday-mvp-score`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saveId, seasonId, matchdayId, source: "sqlite", dryRun: true, execute: false }),
        cache: "no-store",
      }),
    ]);
    dualSamples.push(performance.now() - startedAt);
    if (!contextResult.ok || !scoreResult.ok) {
      dualOk = false;
      dualDetail = `context=${contextResult.status} score=${scoreResult.status}`;
      break;
    }
  }
  results.push(summarize("dual fetch lab-context + mvp-score (parallel)", dualSamples, dualOk, dualDetail));

  const bundleMedian = results.find((entry) => entry.label.includes("arena-base"))?.medianMs ?? 0;
  const dualMedian = results.at(-1)?.medianMs ?? 0;
  const versionMedian = results[0]?.medianMs ?? 0;
  const compactMedian = results[2]?.medianMs ?? 0;

  console.log(
    JSON.stringify(
      {
        ok: results.every((entry) => entry.ok),
        saveId,
        seasonId,
        matchdayId,
        teamId,
        iterations: ITERATIONS,
        baseUrl: BASE_URL,
        results,
        deltas: {
          versionVsCompactInitialMs: compactMedian - versionMedian,
          arenaBundleVsDualMs: dualMedian - bundleMedian,
        },
      },
      null,
      2,
    ),
  );

  if (!results.every((entry) => entry.ok)) {
    process.exitCode = 1;
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
