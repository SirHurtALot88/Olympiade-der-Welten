// Misst, ob die Icon-Schiene beim Ausklappen (Hover) ihre Icons verschiebt. Erwartung: Abweichung 0 px.
// AUFRUF (Server muss laufen): node scripts/messe-schiene-hover.mjs <baseUrl> <saveId> <teamId> [ausgabeOrdner]
// Schreibt je Fenstergröße <ordner>/schiene-kompakt-WxH.png und schiene-hover-WxH.png, Exit 1 bei Abweichung.
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const [baseUrl, saveId, teamId, ausgabe = "docs/design/navigation-hover-fix-18-11"] = process.argv.slice(2);
if (!baseUrl || !saveId || !teamId) {
  console.error("Aufruf: node scripts/messe-schiene-hover.mjs <baseUrl> <saveId> <teamId> [ordner]");
  process.exit(2);
}
await fs.mkdir(ausgabe, { recursive: true });

const browser = await chromium.launch({ args: ["--disable-dev-shm-usage", "--disable-gpu"] });
let fehler = 0;
for (const [w, h] of [
  [1920, 1080],
  [2560, 1440],
]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const url = new URL("/foundation", baseUrl);
  url.searchParams.set("view", "homeV2");
  url.searchParams.set("saveId", saveId);
  url.searchParams.set("team", teamId);
  await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.getByTestId("foundation-sidebar").waitFor({ state: "visible", timeout: 90_000 });
  for (let i = 0; i < 6; i += 1) {
    const zu = page.getByRole("button", { name: /^(Erledigt|Später)$/ }).first();
    if (await zu.isVisible().catch(() => false)) await zu.click();
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(1500);
  await page.mouse.move(w / 2, h / 2);
  await page.waitForTimeout(500);
  const messe = () =>
    page.evaluate(() => {
      const aside = document.querySelector('[data-testid="foundation-sidebar"]');
      const lage = (el) => {
        const r = el.getBoundingClientRect();
        return [Math.round(r.left * 100) / 100, Math.round(r.top * 100) / 100, Math.round(r.width * 100) / 100, Math.round(r.height * 100) / 100];
      };
      const icons = {};
      aside.querySelectorAll(".foundation-sidebar-item .foundation-rail-icon").forEach((el) => {
        const id = el.closest("[data-testid]")?.getAttribute("data-testid") ?? String(Object.keys(icons).length);
        icons[id] = lage(el);
      });
      const wappen = aside.querySelector('[data-testid="foundation-rail-wappen"]');
      const pin = aside.querySelector('[data-testid="foundation-rail-pin"]');
      const kappt = [...aside.querySelectorAll(".foundation-sidebar-item-label")]
        .filter((el) => el.getClientRects().length && el.scrollWidth > el.clientWidth + 1)
        .map((el) => el.textContent);
      const menue = aside.querySelector('[data-testid="foundation-rail-menue"]');
      return {
        modus: aside.getAttribute("data-rail"),
        breite: aside.getBoundingClientRect().width,
        icons,
        wappen: wappen ? lage(wappen) : null,
        pin: pin ? lage(pin) : null,
        kappt,
        menueSichtbar: Boolean(menue && menue.getAttribute("data-offen") === "1"),
        inhaltLinks: Math.round(document.querySelector(".foundation-shell-main")?.getBoundingClientRect().left ?? -1),
      };
    });
  const vor = await messe();
  await page.screenshot({ path: path.join(ausgabe, `schiene-kompakt-${w}x${h}.png`) });
  await page.mouse.move(30, h / 2);
  await page.waitForFunction(() => document.querySelector('[data-testid="foundation-sidebar"]')?.getAttribute("data-rail") === "open", undefined, { timeout: 5000 });
  await page.waitForTimeout(700);
  const nach = await messe();
  await page.screenshot({ path: path.join(ausgabe, `schiene-hover-${w}x${h}.png`) });
  // Menü am Wappen öffnen: auch dann darf kein Icon wandern.
  await page.getByTestId("foundation-rail-wappen").click();
  await page.waitForTimeout(400);
  const mitMenue = await messe();
  await page.screenshot({ path: path.join(ausgabe, `schiene-menue-${w}x${h}.png`) });
  let maxMenue = 0;
  for (const [id, a] of Object.entries(vor.icons)) maxMenue = Math.max(maxMenue, Math.abs(a[1] - (mitMenue.icons[id]?.[1] ?? 1e6)), Math.abs(a[0] - (mitMenue.icons[id]?.[0] ?? 1e6)));
  if (maxMenue !== 0 || !mitMenue.menueSichtbar) fehler += 1;
  console.log(`  mit Menue: max Abweichung ${maxMenue}px, Menue sichtbar ${mitMenue.menueSichtbar}`);
  let maxY = 0;
  let maxX = 0;
  for (const [id, a] of Object.entries(vor.icons)) {
    const b = nach.icons[id];
    if (!b) {
      fehler += 1;
      console.log(`FEHLT ${id}`);
      continue;
    }
    maxY = Math.max(maxY, Math.abs(a[1] - b[1]));
    maxX = Math.max(maxX, Math.abs(a[0] - b[0]));
  }
  const kopfY = Math.max(Math.abs((vor.wappen?.[1] ?? 0) - (nach.wappen?.[1] ?? 0)), Math.abs((vor.pin?.[1] ?? 0) - (nach.pin?.[1] ?? 0)));
  const inhalt = Math.abs(vor.inhaltLinks - nach.inhaltLinks);
  console.log(
    `${w}x${h}: ${Object.keys(vor.icons).length} Icons, max Abweichung y=${maxY}px x=${maxX}px, Kopf y=${kopfY}px, Inhalt x=${inhalt}px, Breite ${vor.breite} -> ${nach.breite}, Menue sichtbar ${vor.menueSichtbar}->${nach.menueSichtbar}, gekappte Labels: ${JSON.stringify(nach.kappt)}`,
  );
  if (maxY !== 0 || maxX !== 0 || kopfY !== 0 || inhalt !== 0 || nach.kappt.length || nach.menueSichtbar || vor.menueSichtbar) fehler += 1;
  await ctx.close();
}
await browser.close();
process.exit(fehler ? 1 : 0);
