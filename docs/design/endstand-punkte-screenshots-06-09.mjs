// Sichtpruefung des Endstand-Overlays fuer Staffel und Takeshi's Castle (Prototyp 06.09.).
//   node endstand-screenshots.mjs <repo>/public <ausgabeordner>
// Eigener HTTP-Server auf public/ (Port 0), Google-Fonts abgebrochen, Rennen bei Tempo 4x
// bis `vorbei()`, dann Screenshot von #endstand und Auslesen des Overlay-Texts.
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { existsSync, mkdirSync } from "node:fs";

const ROOT = process.argv[2], OUT = process.argv[3];
mkdirSync(OUT, { recursive: true });
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".json": "application/json" };
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p === "/") p = "/mockups/battle-mode.html";
    const d = await readFile(join(ROOT, p));
    res.writeHead(200, { "Content-Type": MIME[extname(p)] || "application/octet-stream" }); res.end(d);
  } catch (e) { res.writeHead(404); res.end("nf"); }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
let browser;
try {
  browser = await chromium.launch(existsSync(fest) ? { executablePath: fest, args: ["--no-sandbox", "--disable-dev-shm-usage"] } : {});
  for (const disc of ["staffel", "takeshis-castle"]) {
    const p = await browser.newPage({ viewport: { width: 1300, height: 800 } });
    const fehler = []; p.on("pageerror", (e) => fehler.push(String(e)));
    await p.route("https://fonts.googleapis.com/**", (r) => r.abort());
    await p.route("https://fonts.gstatic.com/**", (r) => r.abort());
    await p.goto(`http://127.0.0.1:${port}/mockups/battle-mode.html`, { waitUntil: "load" });
    await p.waitForFunction(() => window.__arena && window.__arena.setDisc, null, { timeout: 30000 });
    await p.evaluate((d) => window.__arena.setDisc(d), disc);
    await p.click("#t2"); await p.waitForTimeout(300);
    await p.evaluate(() => { const b = document.getElementById("spd"); b.click(); b.click(); document.getElementById("play").click(); });
    await p.waitForFunction(() => window.__arena.vorbei(), null, { timeout: 120000 });
    await p.waitForTimeout(600);
    const kopf = await p.$eval("#score", (n) => n.textContent) + " " + await p.$eval("#klsuffix", (n) => n.textContent);
    const ov = await p.evaluate(() => {
      const e = document.getElementById("endstand");
      const sieger = document.getElementById("esieger").textContent;
      const tafeln = ["etafelL", "etafelR"].map((id) => {
        const b = document.getElementById(id);
        return { name: b.querySelector("h5").textContent,
          kopf: [...b.querySelectorAll("thead th")].map((t) => t.textContent).join(" | "),
          zeilen: [...b.querySelectorAll("tbody tr")].map((tr) => [...tr.children].map((td) => td.textContent).join(" | ")) };
      });
      return { hidden: e.hidden, sieger, tafeln };
    });
    const el = await p.$("#endstand");
    await el.screenshot({ path: `${OUT}/endstand-${disc}-nachher-06-09.png` });
    const ticker = await p.$eval("#feed", (n) => n.innerText);
    console.log("=== " + disc + " ===\nKopfzeile: " + kopf + "\nOverlay sichtbar: " + !ov.hidden + "\n" + ov.sieger);
    for (const t of ov.tafeln) { console.log(t.name + "  [" + t.kopf + "]"); for (const z of t.zeilen) console.log("   " + z); }
    console.log("letzte Tickerzeile: " + ticker.split("\n").filter(Boolean).slice(-1)[0]);
    console.log("Seitenfehler: " + (fehler.length ? fehler.join(" | ") : "keine"));
    await p.close();
  }
} finally { if (browser) await browser.close(); server.close(); }
