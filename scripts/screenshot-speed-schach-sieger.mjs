// Sichtpruefung: (a) Heim ist immer Weiss / Gast immer Schwarz gelabelt, ueber mehrere
// Saaten, und (b) am Spielende ist der Sieger direkt AUF DEM BRETT erkennbar (Glow-Rahmen +
// Koenigs-Glow + Sieg-Zeile statt "Brett X von Y"). Kein Teil der Abnahme-Sonden, nur Beleg.
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { existsSync, mkdirSync } from "node:fs";
import { createServer } from "node:http";
import { createReadStream, statSync } from "node:fs";
import path from "node:path";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = path.join(WURZEL, "public");
const OUT_DIR = process.argv[2] || path.join(WURZEL, "tmp-ux-audit", "speed-schach-sieger");
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const MIME = { ".html": "text/html", ".js": "text/javascript", ".png": "image/png", ".json": "application/json", ".css": "text/css" };

function starteServer() {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url, "http://localhost");
      let p = path.join(PUBLIC, decodeURIComponent(url.pathname));
      if (!p.startsWith(PUBLIC)) { res.writeHead(403); res.end(); return; }
      try {
        const st = statSync(p);
        if (st.isDirectory()) p = path.join(p, "index.html");
        const ext = path.extname(p);
        res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
        createReadStream(p).pipe(res);
      } catch {
        res.writeHead(404); res.end("not found: " + p);
      }
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

const server = await starteServer();
const port = server.address().port;
const SEITE = `http://127.0.0.1:${port}/mockups/battle-mode.html`;
let browser;
try {
  browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
  for (let lauf = 1; lauf <= 3; lauf++) {
    const seite = await browser.newPage({ viewport: { width: 1300, height: 700 } });
    const fehler = [];
    seite.on("pageerror", (e) => fehler.push(String(e)));
    await seite.goto(SEITE, { waitUntil: "networkidle" });
    await seite.waitForFunction(() => window.__arena && window.__arena.setDisc, null, { timeout: 30000 });
    await seite.evaluate(() => window.__arena.setDisc("speed-schach"));
    await seite.click("#t2");
    // 4x Tempo (Klick-Zyklus 1x -> 2x -> 4x), damit das ~60s-Spiel schneller durchlaeuft.
    await seite.click("#spd"); await seite.click("#spd");
    await seite.click("#play");

    // Kurz nach Start: Beschriftung "Weiss"/"Schwarz" pruefen (Heim links, Gast rechts).
    await seite.waitForTimeout(1200);
    await (await seite.$("#cv")).screenshot({ path: path.join(OUT_DIR, `lauf${lauf}-01-start-farben.png`) });

    // Bis "beendet" warten (Phase-Text), harte Obergrenze als Sicherheitsnetz.
    await seite.waitForFunction(() => document.getElementById("phase")?.textContent === "beendet", null, { timeout: 40000 }).catch(() => {});
    await seite.waitForTimeout(300);
    await (await seite.$("#cv")).screenshot({ path: path.join(OUT_DIR, `lauf${lauf}-02-sieger-auf-brett.png`) });

    const stand = await seite.evaluate(() => ({
      score: document.getElementById("score")?.textContent,
      phase: document.getElementById("phase")?.textContent,
      heimName: document.querySelector(".tname.h")?.textContent || null,
      gastName: document.querySelector(".tname.a")?.textContent || null,
    }));
    console.log(`Lauf ${lauf}: phase=${stand.phase} score=${stand.score} heim=${stand.heimName} gast=${stand.gastName}`);
    if (fehler.length) console.error(`Lauf ${lauf} Seitenfehler:`, fehler.slice(0, 5));
    await seite.close();
  }
  console.log("Screenshots in " + OUT_DIR);
} finally {
  if (browser) await browser.close();
  server.close();
}
