import path from "node:path";
import fs from "node:fs/promises";

import { describe, expect, it } from "vitest";

const scriptPath = path.join(process.cwd(), "scripts/smoke-gameplay.ts");
const packagePath = path.join(process.cwd(), "package.json");

describe("gameplay smoke script contract", () => {
  it("exposes read-only and explicit write gameplay smoke commands", async () => {
    const packageJson = JSON.parse(await fs.readFile(packagePath, "utf8")) as { scripts: Record<string, string> };

    expect(packageJson.scripts["app:smoke-gameplay"]).toBe("tsx scripts/smoke-gameplay.ts");
    expect(packageJson.scripts["app:smoke-gameplay-write"]).toContain("--write --confirm-testsave");
  });

  it("covers critical gameplay flows and exports proof files", async () => {
    const scriptText = await fs.readFile(scriptPath, "utf8");

    expect(scriptText).toContain("gameplay-smoke-summary.md");
    expect(scriptText).toContain("gameplay-smoke-proof.json");
    expect(scriptText).toContain("smoke-foundation.png");
    expect(scriptText).toContain("smoke-transfermarkt.png");
    expect(scriptText).toContain("smoke-training.png");
    expect(scriptText).toContain("smoke-lineup.png");
    expect(scriptText).toContain("smoke-arena.png");
    expect(scriptText).toContain("smoke-preseason.png");
    expect(scriptText).toContain("foundation-context-banner");
    expect(scriptText).toContain('timeoutMs: Number(args.get("timeout-ms") ?? "60000")');
    expect(scriptText).toContain("Boolean(select && !select.disabled)");
    expect(scriptText).toContain('page.route("**/api/media/**"');
    expect(scriptText).toContain("save-switch-context-hardening");
    expect(scriptText).toContain("includeSaveSwitch");
    expect(scriptText).toContain("--include-save-switch");
    expect(scriptText).toContain("Save-Wechsel-Smoke im Default deaktiviert");
    expect(scriptText).toContain('value !== "__all_teams__"');
    expect(scriptText).toContain("foundation-save-switch-select");
    expect(scriptText).toContain("foundation-active-save-id");
    expect(scriptText).toContain("transfer-market");
    expect(scriptText).toContain("foundation-training-compact");
    expect(scriptText).toContain("foundation-player-profile");
    expect(scriptText).toContain("transfer-deal-open-button");
    expect(scriptText).toContain("foundation-lineup");
    expect(scriptText).toContain("foundation-cockpit");
    expect(scriptText).toContain("matchdayArena");
    expect(scriptText).toContain(".matchday-arena-lane, .matchday-arena-empty-card, #foundation-matchday-arena .warning-list");
    expect(scriptText).toContain('page.getByRole("button", { name: /^Step$/ })');
    expect(scriptText).toContain('page.getByRole("button", { name: /^Reset$/ })');
    expect(scriptText).toContain("DestructiveSignature");
    expect(scriptText).toContain("mutatingRequests");
    expect(scriptText).toContain("default-read-only-gate");
  });

  it("records a concrete failed proof step when the read-only gate fails", async () => {
    const scriptText = await fs.readFile(scriptPath, "utf8");

    expect(scriptText).toContain('makeStep("default-read-only-gate", "Default Read-only Gate")');
    expect(scriptText).toContain('readOnlyStep.status = "failed"');
    expect(scriptText).toContain("Default smoke observed destructive requests");
    expect(scriptText).toContain("Default smoke destructive signature changed");
  });
});
