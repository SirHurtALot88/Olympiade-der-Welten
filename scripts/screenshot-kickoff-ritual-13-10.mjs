// Sichtprobe Tasks #21/#24a (Basketball-Sprungball/Eishockey-Bully): Screenshot der echten
// Spieltags-Bühne (/dev-arena) direkt nach dem ersten ▶-Klick, während das Ritual steht.
import { chromium } from "playwright";
import { existsSync } from "node:fs";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});

for (const { select, out } of [
  { select: "basketball", out: "/tmp/kickoff-basketball.png" },
  { select: "hockey", out: "/tmp/kickoff-hockey.png" },
]) {
  const seite = await browser.newPage({ viewport: { width: 1100, height: 760 } });
  await seite.goto(`${BASE}/dev-arena`, { waitUntil: "networkidle" });
  await seite.selectOption('[data-testid="prim-select"]', select);
  await seite.waitForTimeout(150);
  const startBtn = seite.getByRole("button", { name: /▶/ }).first();
  await startBtn.click();
  await seite.waitForTimeout(500);
  await seite.screenshot({ path: out });
  console.log(`Screenshot gespeichert: ${out}`);
  await seite.close();
}
await browser.close();
