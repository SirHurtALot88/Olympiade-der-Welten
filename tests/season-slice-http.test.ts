import { describe, expect, it } from "vitest";

import {
  buildSeasonSliceEtag,
  fetchSeasonSliceJson,
  invalidateSeasonSliceClientCache,
  readSeasonSliceClientCache,
  respondWithSliceEtag,
  seedSeasonSliceClientCacheEtagForTests,
  writeSeasonSliceClientCache,
} from "@/lib/foundation/season-slice-http";

describe("season slice http cache", () => {
  it("builds stable etags from save scope", () => {
    expect(
      buildSeasonSliceEtag({
        slice: "ratings-slice",
        saveId: "save-a",
        seasonId: "season-1",
        contentSignature: "sig-1",
      }),
    ).toBe('"ratings-slice:save-a:season-1:sig-1"');
  });

  it("returns 304 when if-none-match matches", () => {
    const request = new Request("http://localhost/api/season/ratings-slice", {
      headers: {
        "If-None-Match": '"ratings-slice:save-a:season-1:sig-1"',
      },
    });
    const response = respondWithSliceEtag(request, {
      slice: "ratings-slice",
      saveId: "save-a",
      seasonId: "season-1",
      contentSignature: "sig-1",
      payload: { ok: true },
    });

    expect(response.status).toBe(304);
    expect(response.headers.get("etag")).toBe('"ratings-slice:save-a:season-1:sig-1"');
  });

  it("reuses client cache entries for unchanged signatures", async () => {
    invalidateSeasonSliceClientCache("save-client-cache");
    const cacheKey = "save-client-cache:season-1:sig-client:sqlite";
    const payload = { items: [{ teamId: "A-A" }] };
    writeSeasonSliceClientCache(
      cacheKey,
      '"standings-overview:save-client-cache:season-1:sig-client"',
      payload,
    );

    expect(readSeasonSliceClientCache(cacheKey, "sig-client")).toEqual(payload);
    expect(readSeasonSliceClientCache(cacheKey, "sig-other")).toBeNull();

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (() => {
      throw new Error("fetch should not run for warm client cache");
    }) as typeof fetch;

    try {
      const result = await fetchSeasonSliceJson({
        cacheKey,
        url: "/api/season/standings-overview?saveId=save-client-cache",
        contentSignature: "sig-client",
      });
      expect(result.fromCache).toBe(true);
      expect(result.payload).toEqual(payload);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("refetches full payload when server returns 304 without a warm client cache", async () => {
    invalidateSeasonSliceClientCache("save-stale-etag");
    const cacheKey = "save-stale-etag:season-1:sig-stale:sqlite";
    seedSeasonSliceClientCacheEtagForTests(
      cacheKey,
      '"standings-overview:save-stale-etag:season-1:sig-stale"',
    );

    const payload = { items: [{ teamId: "A-A" }] };
    const originalFetch = globalThis.fetch;
    let fetchCalls = 0;
    globalThis.fetch = (async (_url, init) => {
      fetchCalls += 1;
      if (fetchCalls === 1) {
        expect(init?.headers).toMatchObject({
          "If-None-Match": '"standings-overview:save-stale-etag:season-1:sig-stale"',
        });
        return new Response(null, {
          status: 304,
          headers: { ETag: '"standings-overview:save-stale-etag:season-1:sig-stale"' },
        });
      }
      expect(init?.headers ?? {}).not.toHaveProperty("If-None-Match");
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ETag: '"standings-overview:save-stale-etag:season-1:sig-stale"',
        },
      });
    }) as typeof fetch;

    try {
      const result = await fetchSeasonSliceJson({
        cacheKey,
        url: "/api/season/standings-overview?saveId=save-stale-etag",
        contentSignature: "sig-stale",
      });
      expect(fetchCalls).toBe(2);
      expect(result.fromCache).toBe(false);
      expect(result.payload).toEqual(payload);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("invalidates only the targeted save client cache entries", () => {
    invalidateSeasonSliceClientCache();
    writeSeasonSliceClientCache(
      "save-a:season-1:sig-a",
      '"standings-overview:save-a:season-1:sig-a"',
      { ok: true },
    );
    writeSeasonSliceClientCache(
      "save-b:season-1:sig-b",
      '"standings-overview:save-b:season-1:sig-b"',
      { ok: true },
    );

    invalidateSeasonSliceClientCache("save-a");

    expect(readSeasonSliceClientCache("save-a:season-1:sig-a", "sig-a")).toBeNull();
    expect(readSeasonSliceClientCache("save-b:season-1:sig-b", "sig-b")).toEqual({ ok: true });
  });
});
