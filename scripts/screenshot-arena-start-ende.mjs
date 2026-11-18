// Sichtpruefung "kein Endstand vor dem Start" und "Ende erst, wenn alle im Ziel sind"
// (Chris' Live-Befunde 18.11., Spieltag 1, D1 Climbing). Serviert public/ selbst (wie
// screenshot-disziplin.mjs), oeffnet die Arena bei 1920x1080, waehlt die Disziplin und nimmt
// drei Bilder auf: vor dem Start, mitten im Lauf, am Ende. Dazu gibt es den HUD-Stand je
// Zeitpunkt aus, damit der Spoiler-Befund auch ohne Bild nachpruefbar ist.
//
// Aufruf: node scripts/screenshot-arena-start-ende.mjs <disziplin> [ausgabeOrdner] [laufMs]
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { existsSync, mkdirSync, createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { sendungsrahmenAus, warteAufAnpfiff } from "./lib/arena-anpfiff.mjs";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// OLY_ARENA_PUBLIC: anderer public/-Ordner (z.B. eine Kopie vom Stand vor einer Aenderung fuer Vorher-Bilder).
const PUBLIC = path.resolve(process.env.OLY_ARENA_PUBLIC || path.join(WURZEL, "public"));
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml", ".webp": "image/webp",
  ".mp3": "audio/mpeg", ".wav": "audio/wav", ".ogg": "audio/ogg", ".woff2": "font/woff2", ".ttf": "font/ttf" };

function starteServer() {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url, "http://localhost");
      let p = path.join(PUBLIC, decodeURIComponent(url.pathname));
      if (!p.startsWith(PUBLIC + path.sep)) { res.writeHead(403); res.end(); return; }
      try {
        if (statSync(p).isDirectory()) p = path.join(p, "index.html");
        res.writeHead(200, { "Content-Type": MIME[path.extname(p)] || "application/octet-stream" });
        createReadStream(p).pipe(res);
      } catch { res.writeHead(404); res.end("not found"); }
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

const [disziplin, ordnerArg, laufMsArg] = process.argv.slice(2);
if (!disziplin) {
  console.error("Nutzung: node scripts/screenshot-arena-start-ende.mjs <disziplin> [ordner] [laufMs]");
  process.exit(1);
}
const ordner = ordnerArg || path.join(WURZEL, "tmp-ux-audit");
const laufMs = Number(laufMsArg || 2500);
mkdirSync(ordner, { recursive: true });
const hud = (seite) => seite.evaluate(() => {
  const t = (id) => (document.getElementById(id) || {}).textContent || "";
  return { score: t("score"), suffix: t("klsuffix"), phase: t("phase"), uhr: t("clock") };
});

const server = await starteServer();
let browser;
try {
  browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
  const seite = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const fehler = [];
  seite.on("pageerror", (e) => fehler.push(String(e)));
  await seite.goto(`http://127.0.0.1:${server.address().port}/mockups/battle-mode.html`, { waitUntil: "networkidle" });
  await seite.waitForFunction(() => window.__arena && window.__arena.setDisc, null, { timeout: 30000 });
  if (disziplin === "alle") {
    // Nur der Stand VOR dem Start, fuer jede Disziplin (alle Chassis): Kopfzeile und Kaderleisten-Mitte.
    const zeilen = await seite.evaluate(async () => {
      const aus = [];
      for (const d of window.__arena.motoren()) {
        window.__arena.setDisc(d);
        await new Promise((r) => setTimeout(r, 120));
        const t = (id) => ((document.getElementById(id) || {}).textContent || "").trim();
        aus.push([d, t("score"), t("kmitte"), t("klsuffix")]);
      }
      return aus;
    });
    for (const [d, score, mitte, suffix] of zeilen) console.log(`${d.padEnd(16)} Kopf "${score}"  Leiste "${mitte}"  (${suffix})`);
    console.log("Seitenfehler: " + (fehler.length ? fehler.join(" | ") : "keine"));
  } else {
  await seite.evaluate((d) => window.__arena.setDisc(d), disziplin);
  await seite.click("#t2").catch(() => {});
  await seite.waitForTimeout(1500);
  console.log("vor dem Start:", JSON.stringify(await hud(seite)));
  await seite.screenshot({ path: path.join(ordner, disziplin + "-1-start.png") });
  // Tempo 4x (zweimal die Tempo-Taste: 1x -> 2x -> 4x), damit auch ein langes Rennen in die Wartezeit passt.
  await seite.click("#spd").catch(() => {});
  await seite.click("#spd").catch(() => {});
  await sendungsrahmenAus(seite, { countdown: true, finale: true, nachlauf: false });
  await seite.click("#play");
  await warteAufAnpfiff(seite);
  await seite.waitForTimeout(laufMs);
  console.log("im Lauf:", JSON.stringify(await hud(seite)));
  await seite.screenshot({ path: path.join(ordner, disziplin + "-2-lauf.png") });
  await seite.waitForFunction(() => {
    const s = window.__arena.anpfiffStatus && window.__arena.anpfiffStatus();
    return s && s.done;
  }, null, { timeout: 400000, polling: 250 });
  await seite.waitForTimeout(4500);
  console.log("am Ende:", JSON.stringify(await hud(seite)));
  await seite.screenshot({ path: path.join(ordner, disziplin + "-3-ende.png") });
  console.log("Seitenfehler: " + (fehler.length ? fehler.join(" | ") : "keine"));
  }
} finally {
  if (browser) await browser.close();
  server.close();
}
