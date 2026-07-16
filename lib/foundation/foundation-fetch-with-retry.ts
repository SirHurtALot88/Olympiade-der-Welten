export type FoundationFetchRetryOptions = {
  retries?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
  onSlow?: () => void;
  slowThresholdMs?: number;
};

export type FoundationFetchResult<T> =
  | { ok: true; data: T; response: Response }
  | { ok: false; error: "network" | "http" | "parse" | "timeout"; response?: Response; cause?: unknown };

export async function foundationFetchWithRetryResponse(
  url: string,
  init: RequestInit = {},
  options: FoundationFetchRetryOptions = {},
): Promise<
  | { ok: true; response: Response }
  | { ok: false; error: "network" | "http" | "timeout"; response?: Response; cause?: unknown }
> {
  const retries = options.retries ?? 2;
  const retryDelayMs = options.retryDelayMs ?? 400;
  const timeoutMs = options.timeoutMs ?? 30_000;
  const slowThresholdMs = options.slowThresholdMs ?? 8_000;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const slowTimer = setTimeout(() => options.onSlow?.(), slowThresholdMs);

    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
        cache: init.cache ?? "no-store",
      });
      clearTimeout(timeoutId);
      clearTimeout(slowTimer);

      if (!response.ok) {
        if (attempt < retries && response.status >= 500) {
          await sleep(retryDelayMs * (attempt + 1));
          continue;
        }
        return { ok: false, error: "http", response };
      }

      return { ok: true, response };
    } catch (cause) {
      clearTimeout(timeoutId);
      clearTimeout(slowTimer);
      const isAbort = cause instanceof DOMException && cause.name === "AbortError";
      if (attempt < retries && !isAbort) {
        await sleep(retryDelayMs * (attempt + 1));
        continue;
      }
      return { ok: false, error: isAbort ? "timeout" : "network", cause };
    }
  }

  return { ok: false, error: "network" };
}

export async function foundationFetchWithRetry<T>(
  url: string,
  init: RequestInit = {},
  options: FoundationFetchRetryOptions = {},
): Promise<FoundationFetchResult<T>> {
  const retries = options.retries ?? 2;
  const retryDelayMs = options.retryDelayMs ?? 400;
  const timeoutMs = options.timeoutMs ?? 30_000;
  const slowThresholdMs = options.slowThresholdMs ?? 8_000;
  let slowTimer: ReturnType<typeof setTimeout> | null = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    slowTimer = setTimeout(() => options.onSlow?.(), slowThresholdMs);

    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
        cache: init.cache ?? "no-store",
      });
      clearTimeout(timeoutId);
      if (slowTimer) {
        clearTimeout(slowTimer);
        slowTimer = null;
      }

      if (!response.ok) {
        if (attempt < retries && response.status >= 500) {
          await sleep(retryDelayMs * (attempt + 1));
          continue;
        }
        return { ok: false, error: "http", response };
      }

      try {
        const data = (await response.json()) as T;
        return { ok: true, data, response };
      } catch (cause) {
        if (attempt < retries) {
          await sleep(retryDelayMs * (attempt + 1));
          continue;
        }
        return { ok: false, error: "parse", response, cause };
      }
    } catch (cause) {
      clearTimeout(timeoutId);
      if (slowTimer) {
        clearTimeout(slowTimer);
        slowTimer = null;
      }
      const isAbort = cause instanceof DOMException && cause.name === "AbortError";
      if (attempt < retries && !isAbort) {
        await sleep(retryDelayMs * (attempt + 1));
        continue;
      }
      return { ok: false, error: isAbort ? "timeout" : "network", cause };
    }
  }

  return { ok: false, error: "network" };
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}
