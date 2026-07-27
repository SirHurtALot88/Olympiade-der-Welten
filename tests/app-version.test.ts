import { readFileSync } from "node:fs";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

// APP_VERSION in lib/app-version.ts is deliberately hardcoded (see comment
// there for why it must not import package.json into a client bundle). This
// test is the guardrail against silent drift between the two.
describe("APP_VERSION matches package.json", () => {
  it("never drifts from package.json's version field", async () => {
    const { APP_VERSION } = await import("@/lib/app-version");
    const packageJsonPath = path.resolve(__dirname, "..", "package.json");
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8")) as { version: string };
    expect(APP_VERSION).toBe(packageJson.version);
  });
});

describe("getAppVersionBadge", () => {
  const ORIGINAL_SHA = process.env.NEXT_PUBLIC_OLY_BUILD_SHA;
  const ORIGINAL_DATE = process.env.NEXT_PUBLIC_OLY_BUILD_DATE;

  afterEach(() => {
    if (ORIGINAL_SHA === undefined) {
      delete process.env.NEXT_PUBLIC_OLY_BUILD_SHA;
    } else {
      process.env.NEXT_PUBLIC_OLY_BUILD_SHA = ORIGINAL_SHA;
    }
    if (ORIGINAL_DATE === undefined) {
      delete process.env.NEXT_PUBLIC_OLY_BUILD_DATE;
    } else {
      process.env.NEXT_PUBLIC_OLY_BUILD_DATE = ORIGINAL_DATE;
    }
    vi.resetModules();
  });

  it("falls back to a clearly non-committal dev marker when build env vars are missing", async () => {
    delete process.env.NEXT_PUBLIC_OLY_BUILD_SHA;
    delete process.env.NEXT_PUBLIC_OLY_BUILD_DATE;
    vi.resetModules();

    const { getAppVersionBadge, APP_VERSION } = await import("@/lib/app-version");
    const badge = getAppVersionBadge();

    expect(badge.isDev).toBe(true);
    expect(badge.compact).toBe(`v${APP_VERSION} · dev`);
    expect(badge.compact).not.toMatch(/undefined/i);
    expect(badge.title).not.toMatch(/undefined/i);
    expect(badge.compact.length).toBeGreaterThan(0);
  });

  it("falls back to dev when only one of SHA/date is present", async () => {
    process.env.NEXT_PUBLIC_OLY_BUILD_SHA = "a04ebb20cafef00dcafef00dcafef00dcafef00";
    delete process.env.NEXT_PUBLIC_OLY_BUILD_DATE;
    vi.resetModules();

    const { getAppVersionBadge } = await import("@/lib/app-version");
    const badge = getAppVersionBadge();

    expect(badge.isDev).toBe(true);
    expect(badge.compact).not.toMatch(/undefined/i);
  });

  it("renders version + compact build date + short SHA when both env vars are present", async () => {
    process.env.NEXT_PUBLIC_OLY_BUILD_SHA = "a04ebb20cafef00dcafef00dcafef00dcafef00";
    process.env.NEXT_PUBLIC_OLY_BUILD_DATE = "2026-07-27T12:34:56Z";
    vi.resetModules();

    const { getAppVersionBadge, APP_VERSION } = await import("@/lib/app-version");
    const badge = getAppVersionBadge();

    expect(badge.isDev).toBe(false);
    expect(badge.compact).toContain(`v${APP_VERSION}`);
    expect(badge.compact).toContain("a04ebb2");
    expect(badge.compact).not.toContain("a04ebb20cafef00dcafef00dcafef00dcafef00");
    expect(badge.compact).not.toMatch(/undefined/i);

    // Hover title carries the FULL sha and the FULL timestamp.
    expect(badge.title).toContain("a04ebb20cafef00dcafef00dcafef00dcafef00");
    expect(badge.title).toContain("2026-07-27T12:34:56Z");
  });

  it("falls back to dev when the build date is unparsable", async () => {
    process.env.NEXT_PUBLIC_OLY_BUILD_SHA = "a04ebb20cafef00dcafef00dcafef00dcafef00";
    process.env.NEXT_PUBLIC_OLY_BUILD_DATE = "not-a-date";
    vi.resetModules();

    const { getAppVersionBadge } = await import("@/lib/app-version");
    const badge = getAppVersionBadge();

    expect(badge.isDev).toBe(true);
    expect(badge.compact).not.toMatch(/undefined/i);
  });
});
