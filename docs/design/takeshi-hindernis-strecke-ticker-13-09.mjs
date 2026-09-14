// Ticker-Sicht EINES Takeshi-Rennens mit dem Rezept aus BAHN_ART (kein Mess-Haken noetig,
// laeuft gegen den echten Produktionscode): eigener HTTP-Server auf public/, Playwright,
// Rennen starten, nach dem Einlauf den Feed auslesen und die neuen Zeilen zaehlen.
//   node docs/design/takeshi-hindernis-strecke-ticker-13-09.mjs <out-dir> [runden]
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";

const WURZEL = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const ROOT = join(WURZEL, "public");
const OUT = process.argv[2] || join(WURZEL, "docs/design");
const RUNDEN = Number(process.argv[3] || 1);
mkdirSync(OUT, { recursive: true });
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".json": "application/json" };
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p === "/") p = "/mockups/battle-mode.html";
    const fp = join(ROOT, p); const d = await readFile(fp);
    res.writeHead(200, { "Content-Type": MIME[extname(fp)] || "application/octet-stream" }); res.end(d);
  } catch (e) { res.writeHead(404); res.end("nf"); }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
let browser;
try {
  browser = await chromium.launch(existsSync(fest) ? { executablePath: fest, args: ["--no-sandbox", "--disable-dev-shm-usage"] } : {});
  for (let runde = 0; runde < RUNDEN; runde++) {
    const p = await browser.newPage({ viewport: { width: 1300, height: 700 } });
    const fehler = []; p.on("pageerror", (e) => fehler.push(String(e)));
    await p.route("https://fonts.googleapis.com/**", (r) => r.abort());
    await p.route("https://fonts.gstatic.com/**", (r) => r.abort());
    // Grosszuegige Fristen: auf einer Maschine mit mehreren parallelen Messreihen
    // (Lastmittel > 30 gemessen) braucht allein das Auswerten der 24k-Zeilen-Engine
    // laenger als Playwrights 30-Sekunden-Standard.
    p.setDefaultTimeout(180000);
    await p.goto(`http://127.0.0.1:${port}/mockups/battle-mode.html`, { waitUntil: "domcontentloaded", timeout: 180000 });
    await p.waitForFunction(() => window.__arena && window.__arena.setDisc, null, { timeout: 180000 });
    await p.evaluate((d) => window.__arena.setDisc(d), "takeshis-castle");
    await p.click("#t2"); await p.waitForTimeout(400);
    const cv = await p.$("#cv");
    await p.click("#play");
    let last = 0;
    if (runde === 0) for (const [ms, tag] of [[4000, "start"], [10000, "mitte"], [18000, "schluss"]]) {
      await p.waitForTimeout(ms - last); last = ms;
      await cv.screenshot({ path: join(OUT, `takeshi-hindernis-strecke-${tag}-13-09.png`) });
    }
    await p.waitForFunction(() => window.__arena.vorbei && window.__arena.vorbei(), null, { timeout: 90000 }).catch(() => {});
    const zeilen = await p.$$eval("#feed div", (ds) => ds.map((d) => d.textContent.trim()));
    if (runde === 0) writeFileSync(join(OUT, "takeshi-hindernis-strecke-ticker-13-09.txt"), zeilen.join("\n"));
    const z = (re) => zeilen.filter((l) => re.test(l)).length;
    console.log(`Rennen ${runde + 1}: ${zeilen.length} Zeilen — "ist seine Stärke" ${z(/ist seine Stärke/)}, ` +
      `"nicht sein Fach" ${z(/nicht sein Fach/)}, rammt ${z(/rammt/)}, ins Leere ${z(/ins Leere/)}, ` +
      `Gedränge ${z(/Gedränge/)}, reisst/stolpert ${z(/reißt die|stolpert/)}, ausgeschieden ${z(/scheidet aus/)}`);
    if (fehler.length) console.log("  Seitenfehler:", fehler.join(" | "));
    await p.close();
  }
} finally { if (browser) await browser.close(); server.close(); }
