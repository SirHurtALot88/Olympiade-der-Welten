// BENCHMARK-SCREENSHOTS BASKETBALL (17.11., docs/design/benchmark-basketball-17-11.md).
//
// Fotografiert feste Spielsituationen aus der ECHTEN Arena-Seite (battle-mode.html, ueber HTTP
// serviert wie scripts/screenshot-disziplin.mjs), reproduzierbar ueber Saat + Situation:
// window.__arena.szeneFeldspiel(saat, situation, ab) spult die Simulation bis zur Situation vor,
// danach steht der Zustand und der Zeichen-Loop malt genau dieses Bild.
//
//   node scripts/screenshot-basketball-benchmark.mjs <zielordner> [praefix] [engine.js]
//   OLY_BB_SZENEN=runde2 node scripts/screenshot-basketball-benchmark.mjs <zielordner> runde2
//
// OLY_BB_SZENEN=runde2 (17.11., Runde 2): fotografiert statt der fuenf Grundsituationen die
// Spielzuege des LAUFWEG-MODULS (Backdoor, Pick, Roll, Post-up, Ausboxen, Fast-Break, Lob,
// Bodenpass, Spot-up/Pull-up/Drive). deviceScaleFactor 1 fuer diese Reihe (kleinere Dateien).
//
// [engine.js] (optional): eine andere Engine-Datei statt public/mockups/battle-mode.engine.js
// ausliefern -- fuer Vorher/Nachher aus demselben Skript (z.B. eine Kopie des main-Stands).
// Die alte Engine braucht dafuer die Sonde szeneFeldspiel; fehlt sie, bricht das Skript ab.
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { existsSync, mkdirSync, createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = path.join(WURZEL, "public");
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml", ".webp": "image/webp",
  ".mp3": "audio/mpeg", ".wav": "audio/wav", ".ogg": "audio/ogg", ".woff2": "font/woff2", ".ttf": "font/ttf" };

const [zielArg, praefix = "nachher", engineArg] = process.argv.slice(2);
if (!zielArg) {
  console.error("Aufruf: node scripts/screenshot-basketball-benchmark.mjs <zielordner> [praefix] [engine.js]");
  process.exit(1);
}
const ziel = path.resolve(zielArg);
mkdirSync(ziel, { recursive: true });
const engineErsatz = engineArg ? path.resolve(engineArg) : null;

// Situation, Saat, fruehester Spielzeitpunkt.
const SZENEN = [
  { name: "1-halbfeld-aufbau", situation: "aufbau", saat: 7, ab: 20 },
  { name: "2-wurf-am-ring", situation: "wurf", saat: 7, ab: 40 },
  { name: "3-dreier-im-flug", situation: "dreier", saat: 42, ab: 10 },
  { name: "4-treffer-im-netz", situation: "treffer", saat: 7, ab: 60 },
  { name: "5-rebound", situation: "rebound", saat: 1, ab: 30 },
];
const SZENEN_RUNDE2 = [
  { name: "r2-01-backdoor-cut", situation: "backdoor", saat: 7, ab: 15 },
  { name: "r2-02-pick-gestellt", situation: "pick", saat: 7, ab: 10 },
  { name: "r2-03-roll-oder-pop", situation: "roll", saat: 42, ab: 10 },
  { name: "r2-04-post-up", situation: "postup", saat: 1, ab: 10 },
  { name: "r2-05-ausboxen", situation: "ausboxen", saat: 7, ab: 30 },
  { name: "r2-06-fast-break-lanes", situation: "fastbreak", saat: 42, ab: 20 },
  { name: "r2-07-lob-pass", situation: "lob", saat: 7, ab: 10 },
  { name: "r2-08-bodenpass", situation: "bodenpass", saat: 1, ab: 10 },
  { name: "r2-09-spot-up", situation: "spotup", saat: 7, ab: 10 },
  { name: "r2-10-pull-up", situation: "pullup", saat: 42, ab: 10 },
  { name: "r2-11-drive", situation: "drive", saat: 1, ab: 10 },
  { name: "r2-12-fx-dunk", situation: "fx-dunk", saat: 7, ab: 10 },
  { name: "r2-13-fx-ringwackeln", situation: "fx-ring", saat: 7, ab: 10 },
  { name: "r2-14-fx-block", situation: "fx-block", saat: 42, ab: 5 },
  { name: "r2-15-fx-dreier-spur", situation: "dreier", saat: 42, ab: 10 },
];
const RUNDE2 = process.env.OLY_BB_SZENEN === "runde2" || process.env.OLY_BB_SZENEN === "kamera";
// OLY_BB_SZENEN=kamera: Bildfolge der Halbfeld-/Folgekamera (Nahzoom auf einen Dreier, danach
// zurueck in den Halbfeld-Ausschnitt), plus die Totale (feldKamera(false)) als Vergleich.
const KAMERA = process.env.OLY_BB_SZENEN === "kamera";

function starteServer() {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url, "http://localhost");
      let p = path.join(PUBLIC, decodeURIComponent(url.pathname));
      if (engineErsatz && url.pathname.endsWith("/mockups/battle-mode.engine.js")) p = engineErsatz;
      else if (!p.startsWith(PUBLIC)) { res.writeHead(403); res.end(); return; }
      try {
        const st = statSync(p);
        if (st.isDirectory()) p = path.join(p, "index.html");
        res.writeHead(200, { "Content-Type": MIME[path.extname(p)] || "application/octet-stream" });
        createReadStream(p).pipe(res);
      } catch {
        res.writeHead(404); res.end("not found");
      }
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

const server = await starteServer();
let browser;
try {
  browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
  const seite = await browser.newPage({ viewport: { width: 1300, height: 700 }, deviceScaleFactor: RUNDE2 ? 1 : 1.5 });
  const fehler = [];
  seite.on("pageerror", (e) => fehler.push(String(e)));
  await seite.goto(`http://127.0.0.1:${server.address().port}/mockups/battle-mode.html`, { waitUntil: "networkidle" });
  await seite.waitForFunction(() => window.__arena && window.__arena.setDisc, null, { timeout: 30000 });
  await seite.evaluate(() => window.__arena.setDisc("basketball"));
  await seite.click("#t2");
  await seite.waitForTimeout(800);
  if (KAMERA) {
    const zeige = async (name) => {
      await seite.evaluate(() => { for (const id of ["einlauf", "bbugcallout", "viertelpause"]) { const e = document.getElementById(id); if (e) e.hidden = true; } });
      const out = path.join(ziel, `${praefix}-${name}.png`);
      await (await seite.$("#cv")).screenshot({ path: out });
      console.log(out);
    };
    await seite.evaluate(() => window.__arena.feldKamera(false));
    await seite.evaluate(() => window.__arena.szeneFeldspiel(42, "dreier", 10));
    await seite.waitForTimeout(400); await zeige("k0-totale");
    await seite.evaluate(() => window.__arena.feldKamera(true));
    await seite.evaluate(() => window.__arena.szeneFeldspiel(7, "aufbau", 20));
    await seite.waitForTimeout(1500); await zeige("k1-halbfeld");
    await seite.evaluate(() => window.__arena.szeneFeldspiel(42, "dreier", 10));
    for (const [ms, n] of [[60, "k2-dreier-0,06s"], [300, "k3-dreier-0,36s"], [500, "k4-dreier-0,86s"], [900, "k5-dreier-1,8s-zurueck"]]) {
      await seite.waitForTimeout(ms); await zeige(n);
    }
    console.log("Seitenfehler: " + (fehler.length ? fehler.join(" | ") : "keine"));
  }
  for (const sz of (KAMERA ? [] : RUNDE2 ? SZENEN_RUNDE2 : SZENEN)) {
    const erg = await seite.evaluate(({ saat, situation, ab }) => {
      if (typeof window.__arena.szeneFeldspiel !== "function") return { fehlt: true };
      return window.__arena.szeneFeldspiel(saat, situation, ab);
    }, sz);
    if (erg.fehlt) throw new Error("window.__arena.szeneFeldspiel fehlt in dieser Engine.");
    // Einlauf-Tafel (Aufstellungen vor dem Anpfiff) verdeckt sonst das Feld.
    // Ereignis-Banner ("DUNK", "FUEHRUNGSWECHSEL") stammen aus dem Vorspulen und verdecken das Feld.
    await seite.evaluate(() => {
      for (const id of ["einlauf", "bbugcallout", "viertelpause"]) { const e = document.getElementById(id); if (e) e.hidden = true; }
    });
    // Runde 2: die Kamera (KAMERA-MODUL) braucht ~1,5 s Wandzeit, bis sie von der vorigen Szene
    // herueber geschwenkt ist.
    await seite.waitForTimeout(RUNDE2 ? 1500 : 500);
    const out = path.join(ziel, `${praefix}-${sz.name}.png`);
    await (await seite.$("#cv")).screenshot({ path: out });
    console.log(`${out}  (${sz.situation}, Saat ${sz.saat}, t=${erg.t}s, Stand ${erg.punkte.join(":")}, gefunden=${erg.gefunden})`);
  }
  console.log("Seitenfehler: " + (fehler.length ? fehler.join(" | ") : "keine"));
} finally {
  if (browser) await browser.close();
  server.close();
}
