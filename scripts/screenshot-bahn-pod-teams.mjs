// Screenshot der Bahn-Disziplinen (Takeshi's Castle, Staffel) mit 2, 3 oder 4 Teams auf der Strecke.
//
// Zweck (Chris 17.11.: "in takeshi ... sind gerade auch nur 2 teams — das sollte doch auch auf 4 teams
// angepasst sein?"): dieselbe Strecke einmal als Duell (2 Teams, Standard der Testseite
// battle-mode.html) und einmal als Pod (3/4 Teams, `__arena.bahnPodAnzeigen`) sichtbar belegen.
//
// Aufruf: node scripts/screenshot-bahn-pod-teams.mjs <disziplin> <teams 2|3|4> <ausgabe.png> [wartenMs] [--ganze-seite]
//   <disziplin>  "takeshis-castle" oder "staffel"
//   <teams>      2 = Duell wie bisher, 3 oder 4 = Pod (die Kader kommen aus data/generated/kaderfamilie-live-save.json)
//   [wartenMs]   Spielzeit nach dem Anpfiff bis zum Foto (Default 4000)
//   --ganze-seite  ganze Seite statt nur der Leinwand (zeigt Kopfzeile/HUD/Tafeln)
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
const [disziplin, teamsText, out, wartenText] = argumente;
const teamsN = Number(teamsText);
if (!disziplin || ![2, 3, 4].includes(teamsN) || !out) {
  console.error("Nutzung: node scripts/screenshot-bahn-pod-teams.mjs <disziplin> <2|3|4> <ausgabe.png> [wartenMs] [--ganze-seite]");
  process.exit(1);
}
const wartenMs = Number(wartenText || 4000);
mkdirSync(path.dirname(path.resolve(out)), { recursive: true });

const familie = JSON.parse(readFileSync(path.join(WURZEL, "data/generated/kaderfamilie-live-save.json"), "utf8"));
const v = familie.varianten;
const kader = [v[0].heim, v[0].gast, v[1].heim, v[1].gast];
const namen = [v[0].heimName, v[0].gastName, v[1].heimName, v[1].gastName];

const server = await new Promise((resolve) => {
  const s = createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    const p = path.join(PUBLIC, decodeURIComponent(url.pathname));
    if (!p.startsWith(PUBLIC)) { res.writeHead(403); res.end(); return; }
    try {
      statSync(p);
      res.writeHead(200, { "Content-Type": MIME[path.extname(p)] || "application/octet-stream" });
      createReadStream(p).pipe(res);
    } catch { res.writeHead(404); res.end(); }
  });
  s.listen(0, "127.0.0.1", () => resolve(s));
});
let browser;
try {
  browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
  const seite = await browser.newPage({ viewport: { width: 1300, height: 900 } });
  const fehler = [];
  seite.on("pageerror", (e) => fehler.push(String(e)));
  await seite.goto(`http://127.0.0.1:${server.address().port}/mockups/battle-mode.html`, { waitUntil: "networkidle" });
  await seite.waitForFunction(() => window.__arena && window.__arena.setDisc, null, { timeout: 30000 });
  const pod = teamsN === 2 ? null
    : { teams: kader.slice(0, teamsN).map((k, i) => ({ name: namen[i] || "Team " + (i + 1), kader: k })), k: 4, saat: 4242, aufstellung: null };
  const zeigt = await seite.evaluate(({ d, pod }) => {
    window.__arena.bahnPodAnzeigen(d, pod);
    window.__arena.setDisc(d);
    return window.__arena.bahnPodAnzeigeStand ? window.__arena.bahnPodAnzeigeStand() : null;
  }, { d: disziplin, pod });
  console.log("Pod-Stand nach Aufbau:", zeigt ? JSON.stringify({ N: zeigt.N, laeufer: zeigt.laeufer, teams: zeigt.teams.map((t) => t.name) }) : "kein Pod (Duell)");
  await seite.click("#t2");
  await sendungsrahmenAus(seite, { countdown: true, finale: false, nachlauf: false });
  await seite.click("#play");
  await warteAufAnpfiff(seite);
  await seite.waitForTimeout(wartenMs);
  if (process.argv.includes("--ende")) {
    await seite.evaluate(() => { const A = window.__arena; for (let i = 0; i < 400 && !A.vorbei(); i += 1) A.sondenLauf(300); });
    await seite.waitForTimeout(1500);
  }
  if (process.argv.includes("--beobachte")) {
    console.log("kmitte-Aenderungen in 3 s:", await seite.evaluate(() => new Promise((res) => {
      const zaehler = { kmitte: 0, kaderL: 0, leiste: 0, klsuffix: 0 };
      const os = Object.keys(zaehler).map((id) => {
        const el = document.getElementById(id === "leiste" ? "bahnPodLeiste" : id);
        if (!el) return null;
        const o = new MutationObserver(() => { zaehler[id] += 1; });
        o.observe(el, { childList: true, characterData: true, subtree: true, attributes: true });
        return o;
      });
      setTimeout(() => { os.forEach((o) => o && o.disconnect()); res(JSON.stringify(zaehler) + " / " + document.getElementById("kmitte").textContent); }, 3000);
    })));
  }
  console.log("Kaderleiste-Mitte (#kmitte):", await seite.evaluate(() => document.getElementById("kmitte").textContent));
  if (GANZE_SEITE) await seite.screenshot({ path: out, fullPage: true });
  else await (await seite.$("#cv")).screenshot({ path: out });
  console.log("Screenshot: " + out);
  console.log("Seitenfehler: " + (fehler.length ? fehler.join(" | ") : "keine"));
} finally {
  if (browser) await browser.close();
  server.close();
}
