/**
 * Ad-hoc UI audit for the "Einsatzliste v2" (LegacyLineupFocusV2Board) improvements.
 * Not a permanent test — scratch script for a one-off Playwright audit against the live dev server.
 * Run: npx tsx scripts/tmp-lineup-v2-audit.ts
 */
import fs from "node:fs/promises";
import path from "node:path";

import { chromium, type Page } from "@playwright/test";

import { createPersistenceService } from "@/lib/persistence/persistence-service";

const BASE_URL = process.env.OLY_BASE_URL ?? "http://localhost:3000";
const SHOT_DIR = path.join(process.cwd(), "tmp", "lineup-v2-audit");
const TIMEOUT_MS = 30_000;

type Finding = { ok: boolean; label: string; detail?: string };

const findings: Finding[] = [];
function record(ok: boolean, label: string, detail?: string) {
  findings.push({ ok, label, detail });
  console.log(`${ok ? "PASS" : "FAIL"} — ${label}${detail ? ` (${detail})` : ""}`);
}

async function dismissSeasonBriefingIfPresent(page: Page) {
  const backdrop = page.getByTestId("season-briefing-backdrop");
  const visible = await backdrop.isVisible().catch(() => false);
  if (!visible) return;
  await page.getByRole("button", { name: "Später" }).first().click({ timeout: 5_000 }).catch(() => undefined);
  await backdrop.waitFor({ state: "hidden", timeout: 5_000 }).catch(() => undefined);
}

async function main() {
  await fs.mkdir(SHOT_DIR, { recursive: true });

  const persistence = createPersistenceService();
  const activeSave = persistence.getActiveSave();
  if (!activeSave) throw new Error("No active save found.");
  const saveId = activeSave.saveId;
  const teamId = activeSave.gameState.teams.some((t) => t.teamId === "A-A")
    ? "A-A"
    : activeSave.gameState.teams[0]?.teamId;
  if (!teamId) throw new Error("Could not resolve a team id.");

  const browserErrors: string[] = [];
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1680, height: 1200 } });
  page.setDefaultTimeout(TIMEOUT_MS);
  page.on("pageerror", (error) => browserErrors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(`console.error: ${message.text()}`);
  });

  try {
    const url = new URL("/foundation", BASE_URL);
    url.searchParams.set("view", "lineupV2");
    url.searchParams.set("team", teamId);
    url.searchParams.set("saveId", saveId);
    await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: TIMEOUT_MS });
    await dismissSeasonBriefingIfPresent(page);

    const panel = page.locator('[data-testid="foundation-lineup-v2"]');
    const board = page.locator('[data-testid="legacy-lineup-v2-board"]');
    try {
      await panel.first().waitFor({ state: "visible", timeout: TIMEOUT_MS });
      await board.first().waitFor({ state: "visible", timeout: TIMEOUT_MS });
      record(true, "Board renders", `panel + board visible for team=${teamId}`);
    } catch (error) {
      record(false, "Board renders", error instanceof Error ? error.message : String(error));
      await page.screenshot({ path: path.join(SHOT_DIR, "00-render-failure.png"), fullPage: true });
      throw error;
    }

    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SHOT_DIR, "01-initial-board.png"), fullPage: true });

    // Helper: read the "D1-2" style label text of the currently active slot row.
    async function getActiveSlotLabel() {
      return board.locator(".legacy-lineup-v2-slot-row.is-active .legacy-lineup-v2-slot-index").first().textContent();
    }
    async function getFlashClass() {
      return board.locator('.velo-impact-card:has-text("Slot")').first().getAttribute("class").catch(() => null);
    }
    async function pollForFlash(maxMs = 800) {
      const step = 60;
      for (let waited = 0; waited < maxMs; waited += step) {
        const cls = await getFlashClass();
        if (cls?.includes("is-flash")) return true;
        await page.waitForTimeout(step);
      }
      return false;
    }

    // 2. Assign a candidate to a slot -> triggers flash + score updates. If every slot already
    // has a player (a fresh save may auto-fill a near-complete lineup), clear one first so we can
    // exercise the same "assign into an open slot" flow the audit is asking about.
    let workingSlotRow = board.locator(".legacy-lineup-v2-slot-row.is-empty").first();
    if ((await workingSlotRow.count()) === 0) {
      const anyRow = board.locator(".legacy-lineup-v2-slot-row").first();
      await anyRow.locator(".legacy-lineup-v2-slot-main").click();
      await page.waitForTimeout(200);
      const clearBtn = anyRow.locator(".legacy-lineup-v2-slot-clear");
      if ((await clearBtn.count()) > 0) {
        await clearBtn.click();
        await page.waitForTimeout(200);
      }
      workingSlotRow = anyRow;
    }
    const hasWorkingSlot = (await workingSlotRow.locator(".legacy-lineup-v2-slot-empty-label").count()) > 0;
    if (hasWorkingSlot) {
      await workingSlotRow.locator(".legacy-lineup-v2-slot-main").click();
      await page.waitForTimeout(250);
      const filledSlotLabel = await getActiveSlotLabel();
      await page.screenshot({ path: path.join(SHOT_DIR, "02-empty-slot-focused.png"), fullPage: true });

      const candidateRow = board.locator(".legacy-lineup-v2-candidate-row:not(.is-blocked) .legacy-lineup-v2-candidate-main-btn").first();
      if ((await candidateRow.count()) > 0) {
        await candidateRow.click();
        const sawFlash = await pollForFlash();
        record(sawFlash, "Assigning candidate triggers flash animation", sawFlash ? undefined : "is-flash class never observed on Slot impact card");
        await page.waitForTimeout(300);
        await page.screenshot({ path: path.join(SHOT_DIR, "03-slot-filled-flash.png"), fullPage: true });

        // Re-focus the slot we just filled (focus auto-advances to the next open slot on assign)
        // so the range bar + intensity test below have real range data to work with.
        await page.locator(`.legacy-lineup-v2-slot-row:has(.legacy-lineup-v2-slot-index:text-is("${filledSlotLabel}"))`).first().locator(".legacy-lineup-v2-slot-main").click();
        await page.waitForTimeout(250);
      } else {
        record(false, "Assigning candidate triggers flash animation", "no unblocked candidate row found for empty slot");
      }
    } else {
      record(false, "Assigning candidate triggers flash animation", "could not free up a slot to test assignment");
    }

    // 3. Intensity switching visibly changes the range band (on the now-filled, refocused slot).
    const activeSideIntensity = board.locator(".legacy-lineup-v2-side.is-d1 .legacy-lineup-v2-intensity").first();
    async function getBandWidthPercent() {
      const band = board.locator(".legacy-lineup-v2-focus-range .velo-range-bar-band").first();
      const style = await band.getAttribute("style").catch(() => null);
      const match = style?.match(/width:\s*([\d.]+)%/);
      return match ? Number(match[1]) : null;
    }
    const rangeBarInFocus = board.locator(".legacy-lineup-v2-focus-range .velo-range-bar").first();
    if ((await rangeBarInFocus.count()) === 0) {
      // Ensure some filled slot is focused so the range bar has data to test against.
      const filledRow = board.locator(".legacy-lineup-v2-slot-row.is-filled").first();
      if ((await filledRow.count()) > 0) {
        await filledRow.locator(".legacy-lineup-v2-slot-main").click();
        await page.waitForTimeout(250);
      }
    }
    if ((await activeSideIntensity.count()) > 0 && (await rangeBarInFocus.count()) > 0) {
      await activeSideIntensity.locator('button:has-text("Schonen")').click().catch(() => undefined);
      await page.waitForTimeout(250);
      const conserveWidth = await getBandWidthPercent();
      await page.screenshot({ path: path.join(SHOT_DIR, "04-intensity-conserve.png"), fullPage: true });

      await activeSideIntensity.locator('button:has-text("Push")').click().catch(() => undefined);
      await page.waitForTimeout(250);
      const pushWidth = await getBandWidthPercent();
      await page.screenshot({ path: path.join(SHOT_DIR, "05-intensity-push-wide-range.png"), fullPage: true });

      await activeSideIntensity.locator('button:has-text("Normal")').click().catch(() => undefined);
      await page.waitForTimeout(250);

      const widthsDiffer = conserveWidth != null && pushWidth != null && Math.abs(pushWidth - conserveWidth) > 1;
      record(widthsDiffer, "Intensity switch changes range band width", `conserve=${conserveWidth}% push=${pushWidth}%`);
    } else {
      record(false, "Intensity switch changes range band width", "no filled active slot with a range bar present to test");
    }

    // 4. Rolle line, range bars, best-slot tags render with real numbers.
    const roleCardText = await board.locator('.velo-impact-card:has-text("Rolle")').first().textContent().catch(() => null);
    record(Boolean(roleCardText && !roleCardText.includes("—")), "Rolle boost line shows a real number", roleCardText ?? undefined);

    const rangeBarCount = await board.locator(".velo-range-bar:not(.is-empty)").count();
    record(rangeBarCount > 0, "Range bars render with real (non-empty) data", `count=${rangeBarCount}`);

    const bestSlotTagCount = await board.locator(".legacy-lineup-v2-best-slot-tag").count();
    record(bestSlotTagCount > 0, "Bester Slot tags render on at least one candidate row", `count=${bestSlotTagCount}`);

    // 5. Keyboard shortcuts.
    await board.locator(".legacy-lineup-v2-slot-row").first().locator(".legacy-lineup-v2-slot-main").click();
    await page.waitForTimeout(200);
    const activeSlotBefore = await getActiveSlotLabel();
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(200);
    const activeSlotAfterDown = await getActiveSlotLabel();
    record(activeSlotBefore !== activeSlotAfterDown, "ArrowDown moves active slot focus", `${activeSlotBefore} -> ${activeSlotAfterDown}`);

    await page.keyboard.press("ArrowUp");
    await page.waitForTimeout(200);
    const activeSlotAfterUp = await getActiveSlotLabel();
    record(activeSlotAfterUp === activeSlotBefore, "ArrowUp moves focus back", `${activeSlotAfterDown} -> ${activeSlotAfterUp}`);
    await page.screenshot({ path: path.join(SHOT_DIR, "06-keyboard-focus.png"), fullPage: true });

    // Digit key assignment: focus an open slot, note its label, press "1", verify THAT slot (by
    // label, not "is-active" which moves on) now shows a filled player.
    const openSlotForKeyboard = board.locator(".legacy-lineup-v2-slot-row.is-empty").first();
    if ((await openSlotForKeyboard.count()) > 0) {
      await openSlotForKeyboard.locator(".legacy-lineup-v2-slot-main").click();
      await page.waitForTimeout(200);
      const targetSlotLabel = await getActiveSlotLabel();
      const firstCandidateName = (await board.locator(".legacy-lineup-v2-candidate-row:not(.is-blocked)").first().locator("strong").first().textContent())?.trim();
      await page.keyboard.press("Digit1");
      await page.waitForTimeout(300);
      const targetSlotRow = board.locator(`.legacy-lineup-v2-slot-row:has(.legacy-lineup-v2-slot-index:text-is("${targetSlotLabel}"))`).first();
      const assignedName = (await targetSlotRow.locator(".legacy-lineup-v2-slot-player strong").first().textContent().catch(() => null))?.trim() ?? null;
      record(Boolean(assignedName && assignedName === firstCandidateName), "Digit '1' assigns ranked candidate #1 to the slot that was open", `expected=${firstCandidateName} got=${assignedName}`);

      // Backspace clears whatever slot is now active (focus auto-advanced after the digit-assign).
      const activeBeforeBackspace = await getActiveSlotLabel();
      const wasFilledBeforeBackspace = await board.locator(".legacy-lineup-v2-slot-row.is-active").first().locator(".legacy-lineup-v2-slot-player").count();
      // Move focus back to a filled slot to make the Backspace check meaningful & deterministic.
      await targetSlotRow.locator(".legacy-lineup-v2-slot-main").click();
      await page.waitForTimeout(200);
      await page.keyboard.press("Backspace");
      await page.waitForTimeout(300);
      const clearedLabel = await targetSlotRow.locator(".legacy-lineup-v2-slot-empty-label").first().isVisible().catch(() => false);
      record(clearedLabel, "Backspace clears active slot", `activeBeforeBackspace=${activeBeforeBackspace} wasFilled=${Boolean(wasFilledBeforeBackspace)}`);

      // Enter assigns top pick to the now-empty (active) slot.
      await page.keyboard.press("Enter");
      await page.waitForTimeout(300);
      const assignedAfterEnter = await targetSlotRow.locator(".legacy-lineup-v2-slot-player strong").first().isVisible().catch(() => false);
      record(assignedAfterEnter, "Enter assigns top pick to open slot");
      await page.screenshot({ path: path.join(SHOT_DIR, "07-keyboard-assigned.png"), fullPage: true });
    } else {
      record(false, "Digit '1' assigns ranked candidate #1 to the slot that was open", "no open slot available to test digit-assign");
    }

    // 6. Player focus interaction.
    const focusBtn = board.locator(".legacy-lineup-v2-focus-btn").first();
    if ((await focusBtn.count()) > 0) {
      await focusBtn.click();
      await page.waitForTimeout(250);
      const bannerVisible = await board.locator(".legacy-lineup-v2-focus-player-banner").isVisible().catch(() => false);
      const highlightedSlots = await board.locator(".legacy-lineup-v2-slot-row.is-focus-better, .legacy-lineup-v2-slot-row.is-focus-worse, .legacy-lineup-v2-slot-row.is-focus-current").count();
      record(bannerVisible && highlightedSlots > 0, "Player focus highlights slots by delta", `banner=${bannerVisible} highlighted=${highlightedSlots}`);
      await page.screenshot({ path: path.join(SHOT_DIR, "08-player-focus.png"), fullPage: true });
      await focusBtn.click();
    } else {
      record(false, "Player focus highlights slots by delta", "no focus button found");
    }

    // 7. Candidate pin/compare.
    const pinButtons = board.locator(".legacy-lineup-v2-pin-btn");
    if ((await pinButtons.count()) >= 2) {
      await pinButtons.nth(0).click();
      await pinButtons.nth(1).click();
      await page.waitForTimeout(250);
      const compareVisible = await board.locator(".legacy-lineup-v2-compare").isVisible().catch(() => false);
      record(compareVisible, "Pinning 2 candidates shows compare panel");
      await page.screenshot({ path: path.join(SHOT_DIR, "09-candidate-compare.png"), fullPage: true });
    } else {
      record(false, "Pinning 2 candidates shows compare panel", "fewer than 2 candidate rows available to pin");
    }

    // 8. Idle tier-glow classes present.
    const tierGlowCount = await board.locator("[class*='is-tier-']").count();
    record(tierGlowCount > 0, "Idle tier-glow classes applied to rows", `count=${tierGlowCount}`);

    const meaningfulErrors = browserErrors.filter(
      (e) => !e.includes("Failed to load resource") && !e.toLowerCase().includes("favicon"),
    );
    record(meaningfulErrors.length === 0, "No console/page errors during flow", meaningfulErrors.slice(0, 5).join(" | "));
  } finally {
    await browser.close().catch(() => undefined);
  }

  const failed = findings.filter((f) => !f.ok);
  console.log("\n=== SUMMARY ===");
  console.log(`${findings.length - failed.length}/${findings.length} checks passed`);
  if (failed.length > 0) {
    console.log("Failed checks:");
    for (const f of failed) console.log(`  - ${f.label}${f.detail ? `: ${f.detail}` : ""}`);
  }
  await fs.writeFile(
    path.join(SHOT_DIR, "findings.json"),
    JSON.stringify({ findings, browserErrors }, null, 2),
    "utf8",
  );
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
