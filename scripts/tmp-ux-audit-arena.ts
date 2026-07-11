import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const OUT = path.join(process.cwd(), "tmp-ux-audit");
const BASE = "http://localhost:3000/foundation?saveId=save-singleplayer-dev";

async function snap(page: import("@playwright/test").Page, name: string) {
  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });
  fs.writeFileSync(path.join(OUT, `${name}.txt`), (await page.locator("body").innerText()).slice(0, 15000));
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto(`${BASE}&view=lineup-v2`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(8000);

  const reloadBtn = page.getByRole("button", { name: "Neu laden" });
  if (await reloadBtn.isVisible().catch(() => false)) {
    await reloadBtn.click();
    await page.waitForTimeout(5000);
  }

  await page.waitForSelector('[data-testid="legacy-lineup-v2-board"]', { timeout: 60000 });

  const autoFill = page.getByRole("button", { name: "Auto-Fill" });
  if (await autoFill.isEnabled().catch(() => false)) {
    await autoFill.click();
    await page.waitForTimeout(1500);
    await snap(page, "09-lineup-autofill");
  }

  const saveBtn = page.locator('[data-testid="lineup-v2-save-button"]');
  if (await saveBtn.isEnabled().catch(() => false)) {
    await saveBtn.click();
    await page.waitForTimeout(2500);
    await snap(page, "10-lineup-saved");
  }

  await page.goto(`${BASE}&view=matchday-arena-v2`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(10000);
  await snap(page, "11-arena-after-lineup");

  const playBtn = page.getByRole("button", { name: "Play" });
  if (await playBtn.isVisible().catch(() => false)) {
    await playBtn.click();
    await page.waitForTimeout(4000);
    await snap(page, "12-arena-reveal-playing");
    await page.waitForTimeout(6000);
    await snap(page, "13-arena-reveal-mid");
  }

  const weiter = page.getByRole("button", { name: "Weiter" }).last();
  if (await weiter.isEnabled().catch(() => false)) {
    for (let i = 0; i < 5; i++) {
      await weiter.click();
      await page.waitForTimeout(800);
    }
    await snap(page, "14-arena-steps-advanced");
  }

  await browser.close();
  console.log("arena flow done");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
