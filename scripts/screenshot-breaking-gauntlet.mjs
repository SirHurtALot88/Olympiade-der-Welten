// Sichtpruefung des Gauntlet-Umbaus (22.09.): laesst Breaking mehrfach mit wechselnden Saaten
// laufen, macht je Lauf einen Zwischenstand- und einen Endstand-Screenshot und druckt den
// Ticker-Feed (Text) samt Kette (wer gegen wen, HP-Balken, "scheidet aus"-Zeilen) auf die
// Konsole -- kein Teil der Abnahme-Sonden (die sind miss-alle-disziplinen.mjs/
// messe-arena-einfluss.mjs), nur Beleg, dass die Kette im Bild UND im Ticker nachvollziehbar
// ist und dass ein einzelner Ueberlebender tatsaechlich mehrere Gegner nacheinander schafft.
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { existsSync, mkdirSync } from "node:fs";
import { createServer } from "node:http";
import { createReadStream, statSync } from "node:fs";
import path from "node:path";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = path.join(WURZEL, "public");
const OUT_DIR = process.argv[2] || path.join(WURZEL, "tmp-ux-audit", "breaking-gauntlet");
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
const SAATEN = [1337, 4242, 90210, 20260922];
try {
  browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
  for (const saat of SAATEN) {
    const seite = await browser.newPage({ viewport: { width: 1300, height: 700 } });
    const fehler = [];
    seite.on("pageerror", (e) => fehler.push(String(e)));
    await seite.goto(SEITE, { waitUntil: "networkidle" });
    await seite.waitForFunction(() => window.__arena && window.__arena.setDisc, null, { timeout: 30000 });
    await seite.evaluate(() => { window.__arena.setDisc("breaking"); });
    await seite.click("#t2");
    await seite.click("#spd"); await seite.click("#spd"); // 4x Tempo
    await seite.click("#play");

    await seite.waitForTimeout(1500);
    await (await seite.$("#cv")).screenshot({ path: path.join(OUT_DIR, `saat${saat}-01-zwischenstand.png`) });

    await seite.waitForFunction(() => document.getElementById("phase")?.textContent === "beendet", null, { timeout: 60000 }).catch(() => {});
    await seite.waitForTimeout(300);
    await (await seite.$("#cv")).screenshot({ path: path.join(OUT_DIR, `saat${saat}-02-endstand.png`) });

    const stand = await seite.evaluate(() => ({
      score: document.getElementById("score")?.textContent,
      phase: document.getElementById("phase")?.textContent,
      feed: Array.from(document.querySelectorAll("#feed > div")).map((r) => r.textContent),
    }));
    console.log(`\n=== Saat ${saat}: phase=${stand.phase} score=${stand.score} ===`);
    const ketten = stand.feed.filter((z) => /scheidet aus|HP \d/.test(z));
    console.log(ketten.slice(-30).join("\n"));
    if (fehler.length) console.error(`Saat ${saat} Seitenfehler:`, fehler.slice(0, 5));
    await seite.close();
  }
  console.log("\nScreenshots in " + OUT_DIR);
} finally {
  if (browser) await browser.close();
  server.close();
}
