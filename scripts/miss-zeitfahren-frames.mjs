// ===================================================================================
// ZEITFAHREN-FRAMEZEIT-SONDE (Chris 17.11.: "time trial ruckelt irgendwann auch sehr doll,
// wenn mehrere modelle unterwegs sind"). Misst ueber die RENNDAUER, nicht in einem Burst:
//   - Frame-Abstand je requestAnimationFrame (p50/p95/max) je Drittel des Rennens,
//   - optional (--cpu) ein V8-CPU-Profil je Drittel mit den teuersten Selbstzeit-Funktionen,
//   - JS-Heap am Anfang/Ende, Zahl der Laeufer.
// Reine Lese-Sonde: keine Wertung wird veraendert.
//
// Aufruf: node scripts/miss-zeitfahren-frames.mjs [--cpu] [--tempo=1|2|4] [--max=240]
//                                                 [--disc=time-trial] [--shot=<datei.jpg>@<sek>,...]
// ===================================================================================
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import http from "node:http";
import { createReadStream, statSync } from "node:fs";
import { sendungsrahmenAus, warteAufAnpfiff } from "./lib/arena-anpfiff.mjs";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// Statischer Server auf public/: die Seite laedt Sprites mit absoluten Pfaden (/sprites/...),
// unter file:// fehlen deshalb ALLE Figuren und Kulissen (Baukasten-Platzhalter) und die Messung
// wuerde die echte Zeichenlast verfehlen.
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".json": "application/json", ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf", ".mp3": "audio/mpeg", ".svg": "image/svg+xml" };
const server = http.createServer((q, a) => {
  const f = path.join(WURZEL, "public", decodeURIComponent(q.url.split("?")[0]));
  try { if (!f.startsWith(path.join(WURZEL, "public")) || !statSync(f).isFile()) throw 0; a.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" }); createReadStream(f).pipe(a); } catch { a.writeHead(404); a.end(); }
}).listen(0);
const SEITE = `http://127.0.0.1:${server.address().port}/mockups/battle-mode.html`;
const arg = (n, d) => { const a = process.argv.find((x) => x.startsWith("--" + n + "=")); return a ? a.split("=").slice(1).join("=") : d; };
const CPU = process.argv.includes("--cpu");
const TEMPO = Number(arg("tempo", 1));
const MAX_S = Number(arg("max", 240));
const DISC = arg("disc", "time-trial");
const FENSTER = Number(arg("fenster", 30));
const SHOTS = arg("shot", "").split(",").filter(Boolean).map((s) => { const [f, t] = s.split("@"); return { f, t: Number(t) }; });

const browser = await chromium.launch({ args: ["--enable-precise-memory-info", "--disable-dev-shm-usage"] });
const seite = await browser.newPage({ viewport: { width: 1300, height: 1000 } });
const fehler = [];
seite.on("pageerror", (e) => fehler.push(String(e)));
// Callback-Zeit je rAF (JS-Teil von loop(): Ticks + draw()), Laeuferzahl auf der Strecke je Frame.
await seite.addInitScript(() => {
  const roh = window.requestAnimationFrame.bind(window);
  window.__cb = [];
  window.requestAnimationFrame = (fn) => roh((ts) => {
    const a = performance.now(); fn(ts); const d = performance.now() - a;
    if (window.__cbAn) { let z = null; try { const p = window.__arena.zeitfahrenVizProbe(); z = [p.rennT, p.reihe.filter((u) => !u.fertig && u.startT <= p.rennT).length, p.reihe.filter((u) => u.fertig).length]; } catch {} window.__cb.push([ts, d, z]); }
  });
}, null);
// --zaehle: zaehlt Canvas-Aufrufe je Frame (getImageData, drawImage, Filter, Gradienten, Text, neue Canvas ...).
if (process.argv.includes("--zaehle")) await seite.addInitScript(() => {
  window.__cnt = {};
  const P = CanvasRenderingContext2D.prototype;
  for (const m of ["getImageData", "putImageData", "drawImage", "fillText", "strokeText", "measureText", "createPattern", "createLinearGradient", "createRadialGradient", "fill", "stroke", "save", "fillRect", "clip"]) {
    const o = P[m]; P[m] = function (...a) { window.__cnt[m] = (window.__cnt[m] || 0) + 1; return o.apply(this, a); };
  }
  const d = Object.getOwnPropertyDescriptor(P, "filter"); Object.defineProperty(P, "filter", { set(v) { if (v !== "none") window.__cnt.filterSet = (window.__cnt.filterSet || 0) + 1; d.set.call(this, v); }, get() { return d.get.call(this); } });
  const ce = document.createElement.bind(document); document.createElement = (t, ...r) => { if (String(t).toLowerCase() === "canvas") window.__cnt.newCanvas = (window.__cnt.newCanvas || 0) + 1; return ce(t, ...r); };
  const tdu = HTMLCanvasElement.prototype.toDataURL; HTMLCanvasElement.prototype.toDataURL = function (...a) { window.__cnt.toDataURL = (window.__cnt.toDataURL || 0) + 1; return tdu.apply(this, a); };
});
// --canvas: wie oft je Sekunde wird in welche Canvas gezeichnet (DOM-Canvas einzeln, Offscreen gebuendelt).
if (process.argv.includes("--canvas")) await seite.addInitScript(() => {
  window.__cvz = new Map();
  const P = CanvasRenderingContext2D.prototype;
  const kenn = (c) => c.isConnected ? ((c.id || c.className || "?") + " " + c.width + "x" + c.height + (c.closest && c.closest("[id]") ? " in#" + c.closest("[id]").id : "")) : "offscreen " + c.width + "x" + c.height;
  for (const m of ["fillRect", "drawImage", "fill", "stroke", "fillText", "clearRect", "putImageData"]) {
    const o = P[m]; P[m] = function (...a) { const k = kenn(this.canvas); window.__cvz.set(k, (window.__cvz.get(k) || 0) + 1); return o.apply(this, a); };
  }
});
await seite.goto(SEITE, { waitUntil: "domcontentloaded", timeout: 180000 });
await seite.waitForFunction(() => window.__arena && window.__arena.zeitfahrenVizProbe, null, { timeout: 90000 });
await seite.click("#t2");
await seite.evaluate((d) => window.__arena.setDisc(d), DISC);
await sendungsrahmenAus(seite, { countdown: true, finale: true, nachlauf: false, figuren: false });
// Frame-Sampler: rAF-Abstaende mit Zeitstempel (Wandzeit) und Rennuhr.
await seite.evaluate(() => {
  window.__frames = [];
  let prev = 0;
  const f = (ts) => {
    if (prev) { let r = null; try { r = window.__arena.zeitfahrenVizProbe().rennT; } catch {} window.__frames.push([ts, ts - prev, r]); }
    prev = ts; requestAnimationFrame(f);
  };
  requestAnimationFrame(f);
});
if (TEMPO !== 1) {
  for (let i = 1; i < TEMPO; i = i * 2) { const knopf = await seite.$("#speed"); if (knopf) await knopf.click(); }
}
await seite.click("#play");
await warteAufAnpfiff(seite);
const cdp = CPU ? await seite.context().newCDPSession(seite) : null;
if (cdp) { await cdp.send("Profiler.enable"); await cdp.send("Profiler.setSamplingInterval", { interval: 500 }); }

const heap = async () => seite.evaluate(() => performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null);
await seite.evaluate(() => { window.__cbAn = true; });
const TRACE = process.argv.includes("--trace");
if (TRACE) await browser.startTracing(seite, { categories: ["devtools.timeline", "disabled-by-default-devtools.timeline", "v8", "blink"] });
const heap0 = await heap();
const start = Date.now();
let profilAn = false, drittel = 0;
const cpuErgebnis = [];
const stopCpu = async () => {
  if (!cdp || !profilAn) return;
  const { profile } = await cdp.send("Profiler.stop"); profilAn = false;
  const selbst = new Map(); const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  const dts = profile.timeDeltas; let ges = 0;
  profile.samples.forEach((id, i) => { const n = byId.get(id); const k = n.callFrame.functionName + ":" + n.callFrame.lineNumber; const dt = dts[i] || 0; selbst.set(k, (selbst.get(k) || 0) + dt); ges += dt; });
  cpuErgebnis.push({ ab: Math.round((Date.now() - start) / 1000), ges, top: [...selbst.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12) });
};
let ende = false; let shotIdx = 0;
for (let i = 0; i < MAX_S && !ende; i++) {
  if (cdp && profilAn && i > 0 && i % FENSTER === 0) await stopCpu();  if (cdp && !profilAn) { await cdp.send("Profiler.start"); profilAn = true; }
  await seite.waitForTimeout(1000);
  const s = (Date.now() - start) / 1000;
  while (shotIdx < SHOTS.length && s >= SHOTS[shotIdx].t) { const d = path.dirname(SHOTS[shotIdx].f); mkdirSync(d, { recursive: true }); await seite.evaluate(() => document.getElementById("cv").scrollIntoView({ block: "start" })); await seite.screenshot({ path: SHOTS[shotIdx].f, type: "jpeg", quality: 70, ...(process.argv.includes("--vollbild") ? {} : { clip: await (async () => { const b = await (await seite.$("#cv")).boundingBox(); const p = await (await seite.$("#ttfokus")).boundingBox().catch(() => null); return { x: b.x, y: b.y, width: b.width, height: Math.min(1000, (p ? p.y + p.height : b.y + b.height) - b.y + 8) }; })() }) }); shotIdx++; }
  if (process.argv.includes("--zaehle")) { const c = await seite.evaluate(() => { const c = window.__cnt; window.__cnt = {}; return c; }); const z = await seite.evaluate(() => window.__arena.zeitfahrenVizProbe()); console.log(`  [${i}s rennT=${z.rennT} laufend=${z.reihe.filter((u) => !u.fertig && u.startT <= z.rennT).length}] ` + Object.entries(c).map(([k, v]) => k + "=" + v).join(" ")); }
  const st = await seite.evaluate(() => ({ ph: document.getElementById("phase")?.textContent, r: window.__arena.zeitfahrenVizProbe().rennT }));
  if (st.ph === "beendet") ende = true;
}
await stopCpu();
if (TRACE) {
  const buf = await browser.stopTracing(); const ev = JSON.parse(buf.toString()).traceEvents;
  const haupt = new Set(ev.filter((e) => e.name === "thread_name" && e.args && e.args.name === "CrRendererMain").map((e) => e.pid + ":" + e.tid));
  const summe = new Map();
  for (const e of ev) if (e.ph === "X" && haupt.has(e.pid + ":" + e.tid)) { const k = e.name; const o = summe.get(k) || [0, 0]; o[0] += e.dur / 1000; o[1]++; summe.set(k, o); }
  // Verlauf: Hauptthread-Zeit je 10-s-Fenster (Commit/ProduceCanvasResource = Canvas-Rasterung, FunctionCall = JS).
  const t0e = Math.min(...ev.filter((e) => e.ph === "X" && haupt.has(e.pid + ":" + e.tid) && e.name === "FunctionCall").map((e) => e.ts));
  const fen = new Map();
  for (const e of ev) if (e.ph === "X" && haupt.has(e.pid + ":" + e.tid) && ["Commit", "Canvas2DResourceProviderSharedImage::ProduceCanvasResource", "FunctionCall", "Layout", "Paint", "MajorGC", "MinorGC", "V8.GC_MC_BACKGROUND_MARKING", "BeginMainFrame"].includes(e.name)) {
    const k = Math.floor((e.ts - t0e) / 10e6); const o = fen.get(k) || {}; o[e.name] = (o[e.name] || 0) + e.dur / 1000; if (e.name === "BeginMainFrame") o.n = (o.n || 0) + 1; fen.set(k, o);
  }
  console.log("  TRACE-Verlauf je 10 s (ms): Commit | ProduceCanvas | JS(FunctionCall) | Layout | Paint | GC");
  [...fen.entries()].sort((a, b) => a[0] - b[0]).forEach(([k, o]) => console.log(`    ${String(k * 10).padStart(4)} s: ${Math.round(o.Commit || 0)} | ${Math.round(o["Canvas2DResourceProviderSharedImage::ProduceCanvasResource"] || 0)} | ${Math.round(o.FunctionCall || 0)} | ${Math.round(o.Layout || 0)} | ${Math.round(o.Paint || 0)} | ${Math.round((o.MajorGC || 0) + (o.MinorGC || 0))}`));
  const gcs = ev.filter((e) => e.ph === "X" && /GC$|^V8\.GC|MinorGC|MajorGC/.test(e.name) && e.dur > 0);
  const gcSum = {}; gcs.forEach((e) => { gcSum[e.name] = gcSum[e.name] || [0, 0, 0]; gcSum[e.name][0] += e.dur / 1000; gcSum[e.name][1]++; gcSum[e.name][2] = Math.max(gcSum[e.name][2], e.dur / 1000); });
  console.log("  TRACE GC (ms gesamt, Anzahl, laengster):", JSON.stringify(Object.fromEntries(Object.entries(gcSum).map(([k, v]) => [k, v.map((x) => Math.round(x))]))));
  const dec = ev.filter((e) => e.ph === "X" && /Decode|ImageDecode|DecodeImage/.test(e.name));
  const decS = {}; dec.forEach((e) => { decS[e.name] = decS[e.name] || [0, 0, 0]; decS[e.name][0] += e.dur / 1000; decS[e.name][1]++; decS[e.name][2] = Math.max(decS[e.name][2], e.dur / 1000); });
  console.log("  TRACE Bild-Decode (ms gesamt, Anzahl, laengster):", JSON.stringify(Object.fromEntries(Object.entries(decS).map(([k, v]) => [k, v.map((x) => Math.round(x))]))));
  const lang = ev.filter((e) => e.ph === "X" && haupt.has(e.pid + ":" + e.tid) && e.name === "RunTask" && e.dur > 40000).sort((a, b) => b.dur - a.dur).slice(0, 12);
  console.log("  TRACE laengste Hauptthread-Tasks (>40 ms):", lang.length);
  for (const t of lang) {
    const kinder = ev.filter((e) => e.ph === "X" && e.tid === t.tid && e.pid === t.pid && e.ts >= t.ts && e.ts + e.dur <= t.ts + t.dur && e !== t && e.dur > t.dur * 0.15).map((e) => e.name + ":" + Math.round(e.dur / 1000)).slice(0, 6).join(", ");
    console.log(`    bei ${((t.ts - t0e) / 1e6).toFixed(1)} s: wand ${Math.round(t.dur / 1000)} ms, cpu ${Math.round((t.tdur || 0) / 1000)} ms  [${kinder}]`);
  }
  console.log("  TRACE Hauptthread (ms, Anzahl), Spitzenreiter (inklusive Zeit, verschachtelt):");
  [...summe.entries()].sort((a, b) => b[1][0] - a[1][0]).slice(0, 25).forEach(([k, [d, n]]) => console.log("    " + d.toFixed(0).padStart(8) + "  " + String(n).padStart(7) + "  " + k));
  const pr = ev.filter((e) => e.ph === "X" && e.name === "FunctionCall" || false).length;
}
const heap1 = await heap();
const fr = await seite.evaluate(() => window.__frames);
const n = await seite.evaluate(() => window.__arena.zeitfahrenVizProbe().reihe.length);
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : NaN; };
const teil = (a, b) => fr.filter((x) => x[0] >= a && x[0] < b).map((x) => x[1]);
const t0 = fr.length ? fr[0][0] : 0, t1 = fr.length ? fr[fr.length - 1][0] : 1, L = (t1 - t0) / 3;
console.log(`ZEITFAHREN-FRAMES  disc=${DISC} tempo=${TEMPO}x laeufer=${n} dauer=${((t1 - t0) / 1000).toFixed(1)} s frames=${fr.length} heap ${heap0} -> ${heap1} MB`);
for (let k = 0; k < 3; k++) {
  const a = teil(t0 + k * L, t0 + (k + 1) * L);
  console.log(`  Drittel ${k + 1}: n=${a.length} p50=${pct(a, .5).toFixed(1)} p95=${pct(a, .95).toFixed(1)} p99=${pct(a, .99).toFixed(1)} max=${Math.max(...a).toFixed(1)} ms  (>50ms: ${a.filter((x) => x > 50).length})`);
}
if (process.argv.includes("--canvas")) { const z = await seite.evaluate(() => [...window.__cvz.entries()]); console.log("  Zeichenaufrufe je Canvas (gesamt):"); z.sort((a, b) => b[1] - a[1]).slice(0, 25).forEach(([k, v]) => console.log("    " + String(v).padStart(9) + "  " + k)); }
const cb = await seite.evaluate(() => window.__cb);
console.log("  JS-Callbackzeit loop()+draw() (ms) je Anzahl Laeufer auf der Strecke:");
for (let k = 0; k <= n; k++) { const a = cb.filter((x) => x[2] && x[2][1] === k).map((x) => x[1]); if (a.length > 20) console.log(`    ${String(k).padStart(2)} auf Strecke: n=${a.length} p50=${pct(a, .5).toFixed(2)} p95=${pct(a, .95).toFixed(2)} max=${Math.max(...a).toFixed(1)}`); }
if (process.argv.includes("--langsam")) { const l = cb.filter((x) => x[1] > 25 && x[2]); console.log(`  Langsame JS-Callbacks (>25 ms): ${l.length} von ${cb.length}`); l.slice(0, 60).forEach((x) => console.log(`    rennT=${x[2][0]} auf Strecke=${x[2][1]} im Ziel=${x[2][2]}  ${x[1].toFixed(0)} ms`)); }
const cbd = [0, 1, 2].map((k) => cb.slice(Math.floor(cb.length * k / 3), Math.floor(cb.length * (k + 1) / 3)).map((x) => x[1]));
console.log("  JS-Callback je Drittel: " + cbd.map((a) => `p50=${pct(a, .5).toFixed(2)} p95=${pct(a, .95).toFixed(2)} max=${Math.max(...a).toFixed(1)}`).join(" | "));
const alle = fr.map((x) => x[1]);
console.log(`  GESAMT:    p50=${pct(alle, .5).toFixed(1)} p95=${pct(alle, .95).toFixed(1)} p99=${pct(alle, .99).toFixed(1)} ms`);
cpuErgebnis.forEach((c) => { console.log("  CPU-Profil bis " + c.ab + " s, Selbstzeit gesamt (ms): " + (c.ges / 1000).toFixed(0)); c.top.forEach(([k, v]) => console.log("    " + (v / 1000).toFixed(0).padStart(7) + "  " + k)); });
console.log("Seitenfehler: " + (fehler.length ? fehler.join(" | ") : "keine"));
await browser.close(); server.close();
