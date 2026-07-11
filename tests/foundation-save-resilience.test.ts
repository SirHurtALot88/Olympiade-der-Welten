import { afterEach, describe, expect, it, vi } from "vitest";

import {
  foundationFetchWithRetry,
  foundationFetchWithRetryResponse,
} from "@/lib/foundation/foundation-fetch-with-retry";

describe("foundation save resilience", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("retries transient network failures and eventually succeeds", async () => {
    let attempts = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        attempts += 1;
        if (attempts < 3) {
          throw new TypeError("network down");
        }
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }),
    );

    const result = await foundationFetchWithRetry<{ ok: boolean }>("/api/singleplayer-state");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.ok).toBe(true);
    }
    expect(attempts).toBe(3);
  });

  it("returns http error without retry on 409 conflict", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: "stale_save_version" }), { status: 409 })),
    );

    const result = await foundationFetchWithRetryResponse("/api/singleplayer-state", { method: "PUT" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("http");
      expect(result.response?.status).toBe(409);
    }
  });

  it("invokes onSlow when fetch exceeds threshold", async () => {
    const onSlow = vi.fn();
    let resolveFetch: ((value: Response) => void) | null = null;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            resolveFetch = resolve;
          }),
      ),
    );

    const pending = foundationFetchWithRetry<{ ok: boolean }>(
      "/api/singleplayer-state",
      {},
      { slowThresholdMs: 5, timeoutMs: 30_000, retries: 0, onSlow },
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
    resolveFetch?.(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    await pending;
    expect(onSlow).toHaveBeenCalledTimes(1);
  });
});
