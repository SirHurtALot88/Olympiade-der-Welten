// Frametimes und Sicht-Aufnahmen fuer Takeshi's Castle im Vier-Team-Pod (Welle 4, 22.11.).
//
// Fuehrt die ECHTE Arena (public/mockups/battle-mode.html) in Echtzeit (Tempo 1x) aus und misst
//   - rAF-Abstaende (Frametimes) ueber die ganze Sendung: Mittel, p95, p99, Max, Anteil > 33 ms/50 ms,
//   - die Sendedauer in Wandsekunden (vom ersten Tick bis `done`),
//   - optional ein CPU-Profil (CDP) mit den teuersten Selbstzeiten,
//   - optional Aufnahmen (Start, Mitte, Ende) -- unter flock /tmp/oly-aufnahme.lock aufrufen.
//
// Aufruf: node scripts/miss-takeshi-frametimes.mjs [--breite=1920 --hoehe=1080] [--tempo=1|2|4]
//         [--profil] [--bilder=<ordner>] [--praefix=vorher] [--max-sek=240] [--saat=4242]
//
// Headless-Chromium ohne GPU ist langsamer als Chris' Rechner: die Zahlen taugen zum VERGLEICH
// vorher/nachher auf demselben Rechner, nicht als Absolutwert.
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { mkdirSync, createReadStream, statSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { sendungsrahmenAus, warteAufAnpfiff } from "./lib/arena-anpfiff.mjs";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = path.resolve(process.env.OLY_ARENA_PUBLIC || path.join(WURZEL, "public"));
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".webp": "image/webp", ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg", ".wav": "audio/wav", ".woff2": "font/woff2", ".ttf": "font/ttf" };

const arg = (n, d) => { const a = process.argv.find((x) => x.startsWith("--" + n + "=")); return a ? a.split("=")[1] : d; };
const breite = Number(arg("breite", 1920)), hoehe = Number(arg("hoehe", 1080));
const tempo = Number(arg("tempo", 1));
const maxSek = Number(arg("max-sek", 240));
const saat = Number(arg("saat", 4242));
const bilder = arg("bilder", null);
const praefix = arg("praefix", "lauf");
const PROFIL = process.argv.includes("--profil");
const disz = arg("disz", "takeshis-castle");

const familie = JSON.parse(readFileSync(path.join(WURZEL, "data/generated/kaderfamilie-live-save.json"), "utf8")).varianten;
const kader = [familie[0].heim, familie[0].gast, familie[1].heim, familie[1].gast];
const namen = [familie[0].heimName, familie[0].gastName, familie[1].heimName, familie[1].gastName];
const pod = { teams: kader.map((k, i) => ({ name: namen[i] || "Team " + (i + 1), kader: k })), k: 4, saat, aufstellung: null };

const server = await new Promise((res) => {
  const s = createServer((req, rsp) => {
    const url = new URL(req.url, "http://localhost");
    const p = path.join(PUBLIC, decodeURIComponent(url.pathname));
    if (!p.startsWith(PUBLIC)) { rsp.writeHead(403); rsp.end(); return; }
    try { statSync(p); rsp.writeHead(200, { "Content-Type": MIME[path.extname(p)] || "application/octet-stream" }); createReadStream(p).pipe(rsp); }
    catch { rsp.writeHead(404); rsp.end(); }
  });
  s.listen(0, "127.0.0.1", () => res(s));
});
const browser = await chromium.launch();
try {
  const seite = await browser.newPage({ viewport: { width: breite, height: hoehe } });
  const fehler = [];
  seite.on("pageerror", (e) => fehler.push(String(e)));
  // Dauer der rAF-Rueckrufe der Arena (JS + synchrones Flushen der Leinwand) je Bild: die Haelfte der
  // Frame-Kosten, die der Haupt-Thread selbst traegt; der Rest ist Raster/Compositing.
  await seite.addInitScript(() => {
    const orig = window.requestAnimationFrame.bind(window);
    window.__cb = [];
    window.requestAnimationFrame = (f) => orig((ts) => { const a = performance.now(); f(ts); window.__cb.push(performance.now() - a); });
  });
  await seite.goto(`http://127.0.0.1:${server.address().port}/mockups/battle-mode.html`, { waitUntil: "networkidle" });
  await seite.waitForFunction(() => window.__arena && window.__arena.setDisc, null, { timeout: 30000 });
  await seite.evaluate(({ d, pod }) => { window.__arena.bahnPodAnzeigen(d, pod); window.__arena.setDisc(d); }, { d: disz, pod });
  await seite.click("#t2").catch(() => {});
  await sendungsrahmenAus(seite, { countdown: true, finale: true, nachlauf: false });
  for (let i = 1; i < tempo; i += tempo === 4 ? 1 : 2) await seite.click("#spd").catch(() => {});
  if (bilder) { mkdirSync(bilder, { recursive: true }); await seite.screenshot({ path: path.join(bilder, `${praefix}-1-start.png`) }); }
  let cdp = null;
  if (PROFIL) { cdp = await seite.context().newCDPSession(seite); await cdp.send("Profiler.enable"); await cdp.send("Profiler.setSamplingInterval", { interval: 500 }); }
  await seite.click("#play");
  await warteAufAnpfiff(seite);
  if (cdp) await cdp.send("Profiler.start");
  await seite.evaluate(() => {
    window.__ft = { t: [], stop: false, t0: performance.now() };
    let l = performance.now();
    const f = (ts) => { const n = performance.now(); const d = n - l; window.__ft.t.push(d); if (d > 60) (window.__ft.lang = window.__ft.lang || []).push([Math.round(n - window.__ft.t0), Math.round(d), window.__arena.anpfiffStatus().ticks]); l = n; if (!window.__ft.stop) requestAnimationFrame(f); };
    requestAnimationFrame(f);
  });
  const t0 = Date.now();
  let gemacht = false, bildMitte = false;
  while (Date.now() - t0 < maxSek * 1000) {
    await seite.waitForTimeout(500);
    const s = await seite.evaluate(() => window.__arena.anpfiffStatus());
    if (bilder && !bildMitte && Date.now() - t0 > 12000) { bildMitte = true; await seite.screenshot({ path: path.join(bilder, `${praefix}-2-lauf.png`) }); }
    if (s.done) { gemacht = true; break; }
  }
  const dauer = (Date.now() - t0) / 1000;
  if (bilder) { await seite.waitForTimeout(800); await seite.screenshot({ path: path.join(bilder, `${praefix}-3-ende.png`) }); }
  const ft = await seite.evaluate(() => { window.__ft.stop = true; return window.__ft.t.slice(5); });
  const lang = await seite.evaluate(() => window.__ft.lang || []);
  const cb = (await seite.evaluate(() => window.__cb)).slice(-ft.length).sort((a, b) => a - b);
  let profil = null;
  if (cdp) {
    const { profile } = await cdp.send("Profiler.stop");
    const selbst = new Map(); const byId = new Map(profile.nodes.map((n) => [n.id, n]));
    const dts = profile.timeDeltas; const proben = profile.samples;
    for (let i = 0; i < proben.length; i++) {
      const n = byId.get(proben[i]); const cf = n.callFrame;
      const k = `${cf.functionName || "(anon)"}:${cf.lineNumber + 1}`;
      selbst.set(k, (selbst.get(k) || 0) + (dts[i] || 0) / 1000);
    }
    profil = [...selbst.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, v]) => `${v.toFixed(0).padStart(7)} ms  ${k}`);
  }
  ft.sort((a, b) => a - b);
  const q = (p) => ft[Math.min(ft.length - 1, Math.floor(p * ft.length))];
  const mittel = ft.reduce((a, b) => a + b, 0) / ft.length;
  const erg = {
    disz, viewport: `${breite}x${hoehe}`, tempo, frames: ft.length, fertig: gemacht,
    sendedauerWandSek: Number(dauer.toFixed(1)),
    ms: { mittel: +mittel.toFixed(2), p50: +q(0.5).toFixed(2), p95: +q(0.95).toFixed(2), p99: +q(0.99).toFixed(2), max: +ft[ft.length - 1].toFixed(1) },
    rueckrufMs: { mittel: +(cb.reduce((a, b) => a + b, 0) / cb.length).toFixed(2), p95: +cb[Math.floor(cb.length * 0.95)].toFixed(2), max: +cb[cb.length - 1].toFixed(1) },
    anteilUeber33ms: +(ft.filter((x) => x > 33.4).length / ft.length * 100).toFixed(1),
    anteilUeber50ms: +(ft.filter((x) => x > 50).length / ft.length * 100).toFixed(1),
    seitenfehler: fehler,
  };
  console.log(JSON.stringify(erg));
  if (process.argv.includes("--lang")) console.log("Frames > 60 ms [ms seit Start, Dauer, Ticks]:", JSON.stringify(lang));
  if (profil) console.log(profil.join("\n"));
} finally {
  await browser.close(); server.close();
}
