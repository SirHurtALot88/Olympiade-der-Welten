// Screenshot Battlefield als Vier-Team-Pod in der sichtbaren Arena (battle-mode.html), wahlweise im
// Standardformat "orte3" (Gefecht je Ort) oder im Fuenf-Punkte-Format "domination5" (17.11.).
//
//   node scripts/screenshot-battlefield-pod.mjs <orte3|domination5> <ausgabe.png> [wartenMs] [--ganze-seite] [--je-seite=4]
//
// Die vier Kader kommen aus data/generated/kaderfamilie-live-save.json (wie screenshot-bahn-pod-teams.mjs).
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { existsSync, mkdirSync, createReadStream, statSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { sendungsrahmenAus, warteAufAnpfiff } from "./lib/arena-anpfiff.mjs";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = path.join(WURZEL, "public");
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".webp": "image/webp" };
const argumente = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const GANZE_SEITE = process.argv.includes("--ganze-seite");
const JE_SEITE = Number((process.argv.find((a) => a.startsWith("--je-seite=")) || "--je-seite=4").split("=")[1]);
// --vorspulen=<Kampfsekunden>: statt Echtzeit-Abspielen per Sonden-Ticks bis zu dieser Kampfzeit (deterministisch).
const VORSPULEN = Number((process.argv.find((a) => a.startsWith("--vorspulen=")) || "--vorspulen=0").split("=")[1]);
// --viewport=1920x1080 (22.11.): Fenstergroesse fuer die Abgleich-Aufnahmen; --duell zeigt statt des Pods das Zweier-Duell.
const [VIEW_B, VIEW_H] = (process.argv.find((a) => a.startsWith("--viewport=")) || "--viewport=1300x900").split("=")[1].split("x").map(Number);
const DUELL = process.argv.includes("--duell");
const [format, out, wartenText] = argumente;
if (!["orte3", "domination5"].includes(format) || !out) {
  console.error("Nutzung: node scripts/screenshot-battlefield-pod.mjs <orte3|domination5> <ausgabe.png> [wartenMs] [--ganze-seite]");
  process.exit(1);
}
const wartenMs = Number(wartenText || 12000);
mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
const v = JSON.parse(readFileSync(path.join(WURZEL, "data/generated/kaderfamilie-live-save.json"), "utf8")).varianten;
const teams = [
  { name: v[0].heimName, kader: v[0].heim }, { name: v[0].gastName, kader: v[0].gast },
  { name: v[1].heimName, kader: v[1].heim }, { name: v[1].gastName, kader: v[1].gast },
];
const server = await new Promise((resolve) => {
  const s = createServer((req, res) => {
    const p = path.join(PUBLIC, decodeURIComponent(new URL(req.url, "http://localhost").pathname));
    if (!p.startsWith(PUBLIC)) { res.writeHead(403); res.end(); return; }
    try { statSync(p); res.writeHead(200, { "Content-Type": MIME[path.extname(p)] || "application/octet-stream" }); createReadStream(p).pipe(res); }
    catch { res.writeHead(404); res.end(); }
  });
  s.listen(0, "127.0.0.1", () => resolve(s));
});
let browser;
try {
  browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
  const seite = await browser.newPage({ viewport: { width: VIEW_B, height: VIEW_H } });
  const fehler = [];
  seite.on("pageerror", (e) => fehler.push(String(e)));
  await seite.goto(`http://127.0.0.1:${server.address().port}/mockups/battle-mode.html`, { waitUntil: "networkidle" });
  await seite.waitForFunction(() => window.__arena && window.__arena.setDisc, null, { timeout: 30000 });
  const stand = await seite.evaluate(({ teams, format, JE_SEITE, DUELL }) => {
    if (!DUELL) window.__arena.battlefieldPodAnzeigen({ teams, k: JE_SEITE, saat: 4242, aufstellung: null, format });
    window.__arena.setDisc("battlefield");
    return window.__arena.battlefieldPodStand();
  }, { teams, format, JE_SEITE, DUELL });
  console.log("Pod-Stand nach Aufbau:", stand ? JSON.stringify({ namen: stand.namen }) : "kein Pod");
  await seite.click("#t2");
  await sendungsrahmenAus(seite, { countdown: true, finale: false, nachlauf: false });
  await seite.click("#play");
  await warteAufAnpfiff(seite);
  if (VORSPULEN > 0) {
    await seite.click("#play");   // Pause: ab hier laeuft nur noch die Sonden-Uhr
    await seite.evaluate((ziel) => {
      const A = window.__arena;
      for (let i = 0; i < 400; i += 1) { const s = A.battlefieldPodStand(); if (!s || s.t >= ziel || s.done) break; A.sondenLauf(120); }
    }, VORSPULEN);
    await seite.waitForTimeout(1500);
  } else {
    await seite.waitForTimeout(wartenMs);
  }
  console.log("Stand:", JSON.stringify(await seite.evaluate(() => {
    const s = window.__arena.battlefieldPodStand(); return s ? { punkte: s.punkte.map((x) => Math.round(x)), t: s.t } : null; })));
  if (GANZE_SEITE) await seite.screenshot({ path: out, fullPage: true });
  else await (await seite.$("#cv")).screenshot({ path: out });
  console.log("Screenshot: " + out);
  console.log("Seitenfehler: " + (fehler.length ? fehler.join(" | ") : "keine"));
} finally {
  if (browser) await browser.close();
  server.close();
}
