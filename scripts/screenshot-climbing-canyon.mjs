// SCREENSHOTS CLIMBING-FORMAT "CANYON" (Bau 18.11.) -- Arena-Szene mit Schalter an, 1920 x 1080, echter Kader
// (erste Paarung der Kaderfamilie aus dem Live-Save, 6 gegen 6). Fuer den Vergleich "Mockup gegen Bau" in
// docs/design/climbing-canyon-bau-18-11.md.
//
// Aufruf (Aufnahmen nur unter der gemeinsamen Sperre, s. CLAUDE.md):
//   flock /tmp/oly-aufnahme.lock node scripts/screenshot-climbing-canyon.mjs [ordner] [--saat=1337]
//
// Die Szenen werden NICHT gestellt: der Lauf ist der gebuchte Lauf derselben Saat (sondenLauf, derselbe
// Takt wie die Wiedergabe); das Skript sucht im Ereignisprotokoll des Motors die Zeitpunkte (erste
// Rangelei, erste Hilfe am Seil, erster am Dach, erste Glocke) und spult die Wiedergabe dorthin.
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { existsSync, mkdirSync, createReadStream, statSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = path.join(WURZEL, "public");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".webp": "image/webp", ".woff2": "font/woff2", ".ttf": "font/ttf" };
const args = process.argv.slice(2);
const ordner = args.find((a) => !a.startsWith("--")) || path.join(WURZEL, "docs", "design", "climbing-canyon-bau-18-11");
const SAAT = Number(args.find((a) => a.startsWith("--saat="))?.split("=")[1] || 1337);
mkdirSync(ordner, { recursive: true });
const v0 = JSON.parse(readFileSync(path.join(WURZEL, "data/generated/kaderfamilie-live-save.json"), "utf8")).varianten[0];

const server = await new Promise((resolve) => {
  const s = createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    let p = path.join(PUBLIC, decodeURIComponent(url.pathname));
    if (!p.startsWith(PUBLIC)) { res.writeHead(403); res.end(); return; }
    try {
      if (statSync(p).isDirectory()) p = path.join(p, "index.html");
      res.writeHead(200, { "Content-Type": MIME[path.extname(p)] || "application/octet-stream" });
      createReadStream(p).pipe(res);
    } catch { res.writeHead(404); res.end(); }
  });
  s.listen(0, "127.0.0.1", () => resolve(s));
});
let browser;
try {
  const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
  browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
  const seite = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const fehler = [];
  seite.on("pageerror", (e) => fehler.push(String(e)));
  await seite.addInitScript(() => {
    window.__olyArenaKader = { seedByDisciplineId: {} };
    window.__olyBahnFlags = { climbingFormat: "canyon" };
  });
  await seite.goto(`http://127.0.0.1:${server.address().port}/mockups/battle-mode.html`, { waitUntil: "networkidle" });
  await seite.waitForFunction(() => window.__arena && window.__arena.setDisc, null, { timeout: 60000 });
  // Ereigniszeiten aus dem gebuchten Lauf derselben Saat
  const zeiten = await seite.evaluate(({ heim, gast, saat }) => {
    const A = window.__arena;
    A.endstandNachlauf(false); A.anpfiffCountdown(false);
    A.kaderSetzen({ heim, gast });
    A.bahnPodAnzeigen("climbing", null);
    window.__olyArenaKader.seedByDisciplineId.climbing = saat;
    return A.canyonEreignisZeiten ? A.canyonEreignisZeiten(saat) : null;
  }, { heim: v0.heim.slice(0, 6), gast: v0.gast.slice(0, 6), saat: SAAT });
  console.log("Ereigniszeiten (Sim-s):", JSON.stringify(zeiten));
  const szenen = [
    ["01-start", 0.8], ["02-band-rangelei", zeiten?.rangel], ["03-seilschaft-hilft", zeiten?.zieht],
    ["04-ueberhang", zeiten?.dach], ["05-topp", zeiten?.ziel], ["06-ende", zeiten?.ende],
  ].filter(([, t]) => t != null).sort((a, b) => a[1] - b[1]);
  await seite.click("#t2");   // Reiter ARENA
  await seite.evaluate(() => { window.__arena.setDisc("climbing"); });
  await seite.waitForTimeout(1500);   // Bilder laden
  let simBisher = 0;
  for (const [name, t] of szenen) {
    const ziel = Math.max(simBisher, t - 0.25);
    await seite.evaluate((sek) => {
      const A = window.__arena, zf = A.canyonZeitDehnung();
      A.sondenLauf(Math.max(0, Math.round(sek * 60 * zf)));
    }, ziel - simBisher);
    // kurzer Nachlauf in kleinen Schritten, damit Kamera und Teilchen sich setzen
    for (let i = 0; i < 12; i++) await seite.evaluate(() => window.__arena.sondenLauf(4));
    simBisher = ziel + (12 * 4) / 60 / (await seite.evaluate(() => window.__arena.canyonZeitDehnung()));
    const datei = path.join(ordner, `${name}.png`);
    const raum = (await seite.$(".arenaraum")) || (await seite.$("#cv"));
    await raum.scrollIntoViewIfNeeded();
    await raum.screenshot({ path: datei });
    console.log(`Screenshot ${datei} (Sim ${simBisher.toFixed(1)} s)`);
  }
  console.log("Seitenfehler: " + (fehler.length ? fehler.join(" | ") : "keine"));
} finally {
  if (browser) await browser.close();
  server.close();
}
