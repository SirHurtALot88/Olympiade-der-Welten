// Sichtprüfung fürs neue Speed-Schach-Bühnenbild (zeichneSchach). Kein Teil der
// Abnahme-Sonden — nur zum Ansehen. Braucht einen echten HTTP-Server (nicht file://),
// weil die Figuren-Sprites über absolute Pfade ("/sprites/buehne/…") geladen werden.
// Serviert public/ selbst, auf einem freien Port, und beendet den Server garantiert
// (try/finally) — auch wenn Playwright unterwegs wirft.
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { existsSync, mkdirSync } from "node:fs";
import { createServer } from "node:http";
import { createReadStream, statSync } from "node:fs";
import path from "node:path";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = path.join(WURZEL, "public");
const OUT_DIR = process.argv[2] || path.join(WURZEL, "tmp-ux-audit");
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
  const seite = await browser.newPage({ viewport: { width: 1300, height: 700 } });
  const fehler = [];
  seite.on("pageerror", (e) => fehler.push(String(e)));
  seite.on("console", (m) => { if (m.type() === "error") fehler.push("console: " + m.text()); });
  await seite.goto(SEITE, { waitUntil: "networkidle" });
  await seite.waitForFunction(() => window.__arena && window.__arena.setDisc, null, { timeout: 30000 });
  await seite.evaluate(() => window.__arena.setDisc("speed-schach"));
  await seite.click("#t2");
  await seite.click("#play");

  // Drei Zeitpunkte eines laufenden Spiels: kurz nach Start, Mitte, spaet — zeigt die
  // Zugliste wachsen und das Brett voranschreiten.
  await seite.waitForTimeout(1500);
  await (await seite.$("#cv")).screenshot({ path: path.join(OUT_DIR, "schach-01-start.png") });

  await seite.waitForTimeout(7000);
  await (await seite.$("#cv")).screenshot({ path: path.join(OUT_DIR, "schach-02-mitte.png") });

  await seite.waitForTimeout(10000);
  await (await seite.$("#cv")).screenshot({ path: path.join(OUT_DIR, "schach-03-spaet.png") });

  // Regie-Automatik: Fokus-Wechsel abwarten und den naechsten Stand festhalten.
  await seite.waitForTimeout(4000);
  await (await seite.$("#cv")).screenshot({ path: path.join(OUT_DIR, "schach-04-regie-wechsel.png") });

  // Klick-Pin: auf das RECHTESTE Mini-Brett klicken und pruefen, dass der Fokus dort
  // haengen bleibt statt weiterzuspringen. Exakte Koordinate wie in zeichneSchach: bei
  // fuenf sichtbaren Mini-Brettern sitzt Slot 5 (der letzte) bei rx=W-80 — derselbe Rand-
  // abstand wie Slot 1 bei rx=80 (spanne=W-160, gleichmaessig verteilt).
  const rect = await seite.$eval("#cv", (el) => { const r = el.getBoundingClientRect(); return { w: r.width, h: r.height, l: r.left, t: r.top }; });
  await seite.mouse.click(rect.l + (rect.w - 80), rect.t + rect.h * 0.80);
  await seite.waitForTimeout(300);
  await (await seite.$("#cv")).screenshot({ path: path.join(OUT_DIR, "schach-05-gepinnt.png") });
  await seite.waitForTimeout(4000);
  await (await seite.$("#cv")).screenshot({ path: path.join(OUT_DIR, "schach-06-gepinnt-spaeter.png") });

  console.log("Screenshots in " + OUT_DIR);
  console.log("Seitenfehler: " + (fehler.length ? fehler.join(" | ") : "keine"));
} finally {
  if (browser) await browser.close();
  server.close();
}
