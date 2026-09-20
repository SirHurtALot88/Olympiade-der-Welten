// Vorher/Nachher-Bildpaare fuer die A0.1-Doku. Wird gegen ZWEI verschiedene Worktrees
// aufgerufen (main-Basislinie und dieser Branch) -- reine Sichthilfe, kein rr().
import { chromium } from "playwright";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { createReadStream, statSync } from "node:fs";
import path from "node:path";

const ROOT = process.argv[2];
const OUT = process.argv[3];
const TAG = process.argv[4]; // "vorher" oder "nachher"
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
mkdirSync(OUT, { recursive: true });
const MIME = { ".html": "text/html", ".js": "text/javascript", ".png": "image/png", ".json": "application/json", ".css": "text/css" };
function starteServer(publicDir) {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url, "http://localhost");
      let p = path.join(publicDir, decodeURIComponent(url.pathname));
      if (!p.startsWith(publicDir)) { res.writeHead(403); res.end(); return; }
      try {
        const st = statSync(p);
        if (st.isDirectory()) p = path.join(p, "index.html");
        const ext = path.extname(p);
        res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
        createReadStream(p).pipe(res);
      } catch { res.writeHead(404); res.end("not found: " + p); }
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}
const PUBLIC = path.join(ROOT, "public");
const server = await starteServer(PUBLIC);
const port = server.address().port;
const SEITE = `http://127.0.0.1:${port}/mockups/battle-mode.html`;
const browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
const seite = await browser.newPage({ viewport: { width: 400, height: 400 } });
await seite.goto(SEITE, { waitUntil: "networkidle" });
await seite.waitForFunction(() => window.__arena && window.__arena.renderProbe, null, { timeout: 30000 });

const upscale = async (dataUrl, faktor) =>
  seite.evaluate(async ({ dataUrl, faktor }) => {
    const img = new Image();
    await new Promise((res) => { img.onload = res; img.src = dataUrl; });
    const c = document.createElement("canvas");
    c.width = img.width * faktor; c.height = img.height * faktor;
    const ctx = c.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL();
  }, { dataUrl, faktor });

const PAARE = [
  { disc: "tennis", name: "Krag'Zul", ani: "shoot", lunge: 0.1, dir: 2, label: "kragzul-tennis" },
  { disc: "fechten", name: "Krolach", ani: "walk", lunge: 0, dir: 2, label: "krolach-fechten" },
  { disc: "speed-schach", name: "Seraph-11", ani: "walk", lunge: 0, dir: 2, label: "seraph11-schach" },
];

for (const p of PAARE) {
  await seite.evaluate((d) => window.__arena.setDisc(d), p.disc);
  await seite.click("#t2");
  await seite.click("#play");
  await seite.waitForTimeout(400);
  const d = await seite.evaluate(
    ({ name, ani, dir, lunge }) => window.__arena.renderProbe(name, ani, true, dir, lunge, 64, null, null),
    { name: p.name, ani: p.ani, dir: p.dir, lunge: p.lunge }
  );
  const gross = await upscale(d, 6);
  writeFileSync(path.join(OUT, `${p.label}-${TAG}.png`), Buffer.from(gross.split(",")[1], "base64"));
}

console.log("Fertig: " + OUT);
await browser.close();
server.close();
