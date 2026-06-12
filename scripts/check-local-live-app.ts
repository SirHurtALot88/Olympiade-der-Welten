type CheckResult = {
  label: string;
  ok: boolean;
  status: number | null;
  detail: string;
};

type ActiveScope = {
  saveId: string;
  seasonId: string;
  matchdayId: string;
};

function parseArgs(argv: string[]) {
  const args = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (!current.startsWith("--")) continue;
    const [key, inlineValue] = current.slice(2).split("=", 2);
    if (inlineValue != null) {
      args.set(key, inlineValue);
      continue;
    }
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      args.set(key, next);
      index += 1;
      continue;
    }
    args.set(key, "true");
  }

  return {
    baseUrl: (args.get("base-url") ?? "http://localhost:3000").replace(/\/$/, ""),
    timeoutMs: Number(args.get("timeout-ms") ?? "10000"),
    startupRetries: Number(args.get("startup-retries") ?? "20"),
    startupDelayMs: Number(args.get("startup-delay-ms") ?? "1000"),
  };
}

async function wait(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchCheck(baseUrl: string, pathname: string, timeoutMs: number, expectedContent?: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}${pathname}`, {
      cache: "no-store",
      signal: controller.signal,
    });
    const text = await response.text();
    const ok = response.ok && (expectedContent ? text.includes(expectedContent) : true);
    return {
      label: pathname,
      ok,
      status: response.status,
      detail: ok
        ? "ok"
        : expectedContent && !text.includes(expectedContent)
          ? `missing expected content: ${expectedContent}`
          : "unexpected response",
    } satisfies CheckResult;
  } catch (error) {
    const detail =
      error instanceof Error && error.name === "AbortError"
        ? "request timeout"
        : error instanceof Error
          ? error.message
          : String(error);
    return {
      label: pathname,
      ok: false,
      status: null,
      detail,
    } satisfies CheckResult;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson<T>(baseUrl: string, pathname: string, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}${pathname}`, {
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`GET ${pathname} failed: ${response.status} ${text.slice(0, 200)}`);
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

async function loadActiveScope(baseUrl: string, timeoutMs: number): Promise<ActiveScope> {
  const body = await fetchJson<{
    save?: {
      saveId?: string;
      gameState?: {
        season?: { id?: string };
        matchdayState?: { matchdayId?: string };
      };
    } | null;
  }>(baseUrl, "/api/singleplayer-state", timeoutMs);

  const saveId = body.save?.saveId;
  const seasonId = body.save?.gameState?.season?.id;
  const matchdayId = body.save?.gameState?.matchdayState?.matchdayId;

  if (!saveId || !seasonId || !matchdayId) {
    throw new Error("active sqlite save/season/matchday scope could not be resolved from /api/singleplayer-state");
  }

  return {
    saveId,
    seasonId,
    matchdayId,
  };
}

async function main() {
  const { baseUrl, timeoutMs, startupRetries, startupDelayMs } = parseArgs(process.argv.slice(2));
  let lastChecks: CheckResult[] = [];
  let activeScope: ActiveScope | null = null;
  let lastError: string | null = null;

  for (let attempt = 0; attempt <= startupRetries; attempt += 1) {
    const foundationCheck = await fetchCheck(baseUrl, "/foundation", timeoutMs);
    lastChecks = [foundationCheck];

    try {
      if (!foundationCheck.ok) {
        throw new Error(
          foundationCheck.status == null
            ? "dev server not running"
            : `foundation not ready yet (${foundationCheck.status} ${foundationCheck.detail})`,
        );
      }

      activeScope = await loadActiveScope(baseUrl, timeoutMs);
      const transfermarktParams = new URLSearchParams({
        saveId: activeScope.saveId,
        seasonId: activeScope.seasonId,
        limit: "5",
      });
      const standingsParams = new URLSearchParams({
        saveId: activeScope.saveId,
        seasonId: activeScope.seasonId,
        matchdayId: activeScope.matchdayId,
      });

      const checks = await Promise.all([
        Promise.resolve(foundationCheck),
        fetchCheck(baseUrl, `/api/transfermarkt/free-agents?${transfermarktParams.toString()}`, timeoutMs, "\"items\""),
        fetchCheck(baseUrl, `/api/transfermarkt/history?${transfermarktParams.toString()}`, timeoutMs, "\"items\""),
        fetchCheck(baseUrl, `/api/standings/preview?${standingsParams.toString()}`, timeoutMs, "\"items\""),
        fetchCheck(
          baseUrl,
          `/api/season/prize-preview?${new URLSearchParams({
            saveId: activeScope.saveId,
            seasonId: activeScope.seasonId,
          }).toString()}`,
          timeoutMs,
          "\"items\"",
        ),
      ]);
      lastChecks = checks;

      const failed = checks.filter((entry) => !entry.ok);
      if (failed.length === 0) {
        break;
      }
      lastError = failed.map((entry) => `${entry.label}: ${entry.detail}`).join(" | ");
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }

    if (attempt < startupRetries) {
      await wait(startupDelayMs);
    }
  }

  console.log(`live check baseUrl: ${baseUrl}`);
  if (activeScope) {
    console.log(
      `active scope: saveId=${activeScope.saveId} seasonId=${activeScope.seasonId} matchdayId=${activeScope.matchdayId}`,
    );
  } else if (lastError) {
    console.log(`active scope: unresolved (${lastError})`);
  }

  for (const result of lastChecks) {
    console.log(
      `${result.ok ? "OK" : "ERR"} ${result.label} ${result.status != null ? `[${result.status}]` : ""} ${result.detail}`.trim(),
    );
  }

  const failed = lastChecks.filter((entry) => !entry.ok);
  if (!activeScope || failed.length > 0) {
    if (lastError) {
      console.error(lastError);
    }
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
