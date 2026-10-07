// GEZIELTE Sichtpruefung fuer den Football-Fix (F1-Broadcast-Audit Runde 2, 30.09., Punkt 1):
// wartet bis zum ERSTEN Punktestand-Wechsel (Touchdown/Field Goal), damit sich pruefen
// laesst, dass #score/#kmitte und Ticker/Callouts jetzt DIESELBE Zahl zeigen -- die
// alte Version blieb bei einem erfolgreichen Extra-Punkt genau einen Punkt zurueck.
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { existsSync, mkdirSync, createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = path.join(WURZEL, "public");
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png" };

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
      } catch { res.writeHead(404); res.end("not found: " + p); }
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

const ausgabeOrdner = path.join(WURZEL, "tmp-ux-audit", "standkonsistenz-30-09");
mkdirSync(ausgabeOrdner, { recursive: true });
const server = await starteServer();
const port = server.address().port;
const SEITE = `http://127.0.0.1:${port}/mockups/battle-mode.html`;
let browser;
try {
  browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
  const seite = await browser.newPage({ viewport: { width: 1300, height: 900 } });
  await seite.addStyleTag({ content: "body{background:#0B1018}" });
  await seite.goto(SEITE, { waitUntil: "networkidle" });
  await seite.evaluate(() => {
    document.documentElement.setAttribute("data-theme", "dark");
    document.querySelector(".oly-battle-arena")?.classList.add("im-spiel");
  });
  await seite.waitForFunction(() => window.__arena && window.__arena.setDisc, null, { timeout: 30000 });
  await seite.evaluate(() => window.__arena.setDisc("football"));
  await seite.click("#t2");
  await seite.click("#play");
  await warteAufAnpfiff(seite); // Sendungsrahmen-Paket 07.10.: Anpfiff-Countdown abwarten, s. scripts/lib/arena-anpfiff.mjs

  const lies = () => seite.evaluate(() => ({
    score: document.getElementById("score")?.textContent?.trim() || null,
    kmitte: document.getElementById("kmitte")?.textContent?.trim() || null,
    bbugMitte: document.getElementById("bbugMitte")?.textContent?.trim() || null,
    feed: Array.from(document.querySelectorAll("#feed div")).slice(-6).map(d => d.textContent.trim()),
  }));

  let letzterScore = "0 : 0";
  let treffer = false;
  for (let i = 0; i < 90 && !treffer; i++) {
    await seite.waitForTimeout(4000);
    const z = await lies();
    if (z.score !== letzterScore) {
      treffer = true;
      letzterScore = z.score;
      const out = path.join(ausgabeOrdner, "football-erster-treffer.png");
      const frame = await seite.$("#p2 .frame");
      await frame.screenshot({ path: out });
      console.log(`ERSTER TREFFER nach ~${(i + 1) * 4}s: score="${z.score}" kmitte="${z.kmitte}" bbugMitte="${z.bbugMitte}"`);
      console.log("Letzte Ticker-Zeilen:\n  " + z.feed.join("\n  "));
      console.log("Screenshot: " + out);
    }
  }
  if (!treffer) console.log("Kein Treffer innerhalb der Wartezeit -- Score blieb bei " + letzterScore);

  // Noch ein paar Sekunden weiterlaufen lassen, um ggf. einen Extra-Punkt zu erwischen,
  // dann Endstand/Verlauf protokollieren.
  await seite.waitForTimeout(20000);
  const z2 = await lies();
  const out2 = path.join(ausgabeOrdner, "football-danach.png");
  const frame2 = await seite.$("#p2 .frame");
  await frame2.screenshot({ path: out2 });
  console.log(`20s spaeter: score="${z2.score}" kmitte="${z2.kmitte}" bbugMitte="${z2.bbugMitte}"`);
  console.log("Letzte Ticker-Zeilen:\n  " + z2.feed.join("\n  "));
  console.log("Screenshot: " + out2);
} finally {
  if (browser) await browser.close();
  server.close();
}
