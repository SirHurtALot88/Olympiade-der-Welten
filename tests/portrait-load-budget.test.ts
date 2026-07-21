import { afterEach, describe, expect, it } from "vitest";

import {
  acquirePortraitLoadSlot,
  getActivePortraitLoadCountForTests,
  getPortraitLoadBudgetLimit,
  resetPortraitLoadBudgetForTests,
} from "@/lib/foundation/portrait-load-budget";

afterEach(() => {
  resetPortraitLoadBudgetForTests();
});

describe("portrait load budget", () => {
  it("holds the slot until release() is called, so the concurrency cap is real", async () => {
    const limit = getPortraitLoadBudgetLimit();

    // Fill the budget exactly to the limit.
    const releases: Array<() => void> = [];
    for (let i = 0; i < limit; i += 1) {
      releases.push(await acquirePortraitLoadSlot());
    }
    expect(getActivePortraitLoadCountForTests()).toBe(limit);

    // One more must NOT acquire until a slot is released (would-be no-op bug).
    let extraAcquired = false;
    const extra = acquirePortraitLoadSlot().then((release) => {
      extraAcquired = true;
      return release;
    });
    await Promise.resolve();
    expect(extraAcquired).toBe(false);

    // Release one → the queued acquire proceeds.
    releases[0]!();
    const extraRelease = await extra;
    expect(extraAcquired).toBe(true);
    expect(getActivePortraitLoadCountForTests()).toBe(limit);

    // release() is idempotent.
    extraRelease();
    extraRelease();
    releases.slice(1).forEach((release) => release());
    expect(getActivePortraitLoadCountForTests()).toBe(0);
  });
});
