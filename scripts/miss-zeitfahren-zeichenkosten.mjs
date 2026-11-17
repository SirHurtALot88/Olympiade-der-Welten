// ===================================================================================
// ZEITFAHREN-ZEICHENKOSTEN (Chris 17.11.: "time trial ruckelt irgendwann auch sehr doll, wenn
// mehrere modelle unterwegs sind"). Deterministische Gegenprobe zu miss-zeitfahren-frames.mjs:
// die Wandzeit-Frames dort schwanken mit der Maschinenlast (andere Prozesse!), die Kosten EINES
// draw() in einem festen Rennzustand nicht so stark. Mechanik: window.__arena.setDisc("time-trial")
// baut das Rennen auf, sondenLauf(n) rechnet n feste Ticks und zeichnet; sondenLauf(0) ist dann
// genau ein draw(). Nach jedem draw() erzwingt ein getImageData(0,0,1,1) die Rasterung, sonst
// misst man nur das Aufzeichnen der Canvas-Befehle.
//
// Je Messpunkt (Rennzustand) werden N draws gemessen: Median/p95 in ms, dazu Canvas-Aufrufe je
// draw (fillRect/stroke/fill/drawImage/fillText/save) und die Zahl der Laeufer auf der Strecke.
//
// Aufruf: node scripts/miss-zeitfahren-zeichenkosten.mjs [--n=25] [--bis=4000] [--schritt=250] [--fokus=wechsel]
//   --fokus=wechsel   springt zwischen den Messpunkten reihum auf einen anderen Laeufer (Kamera).
// ===================================================================================
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { createReadStream, statSync } from "node:fs";
import path from "node:path";
import http from "node:http";
import { sendungsrahmenAus } from "./lib/arena-anpfiff.mjs";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const arg = (n, d) => { const a = process.argv.find((x) => x.startsWith("--" + n + "=")); return a ? a.split("=").slice(1).join("=") : d; };
const CPU = process.argv.includes("--cpu");
const N = Number(arg("n", 25)), BIS = Number(arg("bis", 4000)), SCHRITT = Number(arg("schritt", 250));
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".json": "application/json", ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf", ".mp3": "audio/mpeg", ".svg": "image/svg+xml" };
const server = http.createServer((q, a) => {
  const f = path.join(WURZEL, "public", decodeURIComponent(q.url.split("?")[0]));
  try { if (!f.startsWith(path.join(WURZEL, "public")) || !statSync(f).isFile()) throw 0; a.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" }); createReadStream(f).pipe(a); } catch { a.writeHead(404); a.end(); }
}).listen(0);
const SEITE = `http://127.0.0.1:${server.address().port}/mockups/battle-mode.html`;

const browser = await chromium.launch({ args: ["--enable-precise-memory-info", "--disable-dev-shm-usage"] });
const seite = await browser.newPage({ viewport: { width: 1300, height: 1000 } });
const fehler = [];
seite.on("pageerror", (e) => fehler.push(String(e)));
await seite.addInitScript(() => {
  window.__cnt = {};
  const P = CanvasRenderingContext2D.prototype;
  for (const m of ["fillRect", "stroke", "fill", "drawImage", "fillText", "strokeText", "measureText", "save", "getImageData", "createLinearGradient", "createRadialGradient"]) {
    const o = P[m]; P[m] = function (...a) { window.__cnt[m] = (window.__cnt[m] || 0) + 1; return o.apply(this, a); };
  }
});
await seite.goto(SEITE, { waitUntil: "domcontentloaded", timeout: 180000 });
await seite.waitForFunction(() => window.__arena && window.__arena.sondenLauf, null, { timeout: 90000 });
await seite.click("#t2");
await seite.evaluate(() => window.__arena.setDisc("time-trial"));
await sendungsrahmenAus(seite, { countdown: true, finale: true, nachlauf: true, figuren: false });
// Figuren/Kulisse laden lassen (Bilder kommen asynchron), sonst misst man Baukasten-Platzhalter.
await seite.waitForTimeout(6000);
await seite.evaluate(() => window.__arena.sondenLauf(1));

const messe = (n) => seite.evaluate((n) => {
  const cv = document.getElementById("cv"), c = cv.getContext("2d");
  const zeiten = [];
  window.__cnt = {};
  for (let i = 0; i < n; i++) { const a = performance.now(); window.__arena.sondenLauf(0); c.getImageData(0, 0, 1, 1); zeiten.push(performance.now() - a); }
  const cnt = {}; for (const k in window.__cnt) cnt[k] = Math.round(window.__cnt[k] / n);
  zeiten.sort((x, y) => x - y);
  const p = window.__arena.zeitfahrenVizProbe();
  return { med: zeiten[Math.floor(n / 2)], p95: zeiten[Math.min(n - 1, Math.floor(n * 0.95))], cnt, rennT: p.rennT, auf: p.reihe.filter((u) => !u.fertig && u.startT <= p.rennT).length, ziel: p.reihe.filter((u) => u.fertig).length, heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null };
}, n);

// --ablation[=tick]: im festen Rennzustand je Variante einen Canvas-Befehlstyp abschalten (No-Op) und die
// CPU-Zeit je draw vergleichen -> zeigt, welcher Befehlstyp die Rasterung dominiert.
if (process.argv.some((a) => a.startsWith("--ablation"))) {
  const tk = Number((process.argv.find((a) => a.startsWith("--ablation=")) || "--ablation=2400").split("=")[1]);
  await seite.evaluate((t) => window.__arena.sondenLauf(t), tk);
  const cdp0 = await seite.context().newCDPSession(seite); await cdp0.send("Performance.enable");
  const tt0 = async () => (await cdp0.send("Performance.getMetrics")).metrics.find((m) => m.name === "ThreadTime").value;
  const varianten = [["alles", []], ["ohne drawImage", ["drawImage"]], ["ohne fillText/strokeText", ["fillText", "strokeText"]], ["ohne stroke", ["stroke"]], ["ohne fill", ["fill"]], ["ohne fillRect", ["fillRect"]], ["ohne clip", ["clip"]], ["ohne gradient-fill (createLinearGradient->leer)", ["createLinearGradient", "createRadialGradient"]], ["gar nichts (alle aus)", ["drawImage", "fillText", "strokeText", "stroke", "fill", "fillRect", "clip"]]];
  console.log(`ABLATION bei tick ${tk} (CPU-ThreadTime ms je draw, 3 Wiederholungen je Variante, Median)`);
  for (const [name, aus] of varianten) {
    const res = [];
    for (let w = 0; w < 3; w++) {
      await seite.evaluate((aus) => { window.__alt = {}; const P = CanvasRenderingContext2D.prototype; for (const m of aus) { window.__alt[m] = P[m]; P[m] = m.startsWith("create") ? function () { return window.__alt[m].call(this, 0, 0, 1, 1); } : function () {}; } }, aus);
      const a = await tt0(); await messe(N); res.push(((await tt0()) - a) * 1000 / N);
      await seite.evaluate((aus) => { const P = CanvasRenderingContext2D.prototype; for (const m of aus) P[m] = window.__alt[m]; }, aus);
    }
    res.sort((x, y) => x - y); console.log(`  ${name.padEnd(48)} ${res[1].toFixed(1)} ms   (${res.map((x) => x.toFixed(1)).join(", ")})`);
  }
  console.log("Seitenfehler: " + (fehler.length ? fehler.join(" | ") : "keine"));
  await browser.close(); server.close(); process.exit(0);
}
console.log("ZEITFAHREN-ZEICHENKOSTEN  (ms je draw inkl. Rasterung; Canvas-Aufrufe je draw)");
const cdp = await seite.context().newCDPSession(seite); await cdp.send("Performance.enable");
let ticks = 0, fokusI = 0;
const ids = await seite.evaluate(() => window.__arena.zeitfahrenVizProbe().reihe.map((u) => u.id));
while (ticks <= BIS) {
  if (process.argv.includes("--fokus=wechsel")) await seite.evaluate((id) => { const b = document.querySelector(`#ttroster .ttchip[data-id="${id}"]`); if (b) b.dispatchEvent(new MouseEvent("mousedown", { bubbles: true })); }, ids[fokusI++ % ids.length]);
  const tt = async () => (await cdp.send("Performance.getMetrics")).metrics.find((m) => m.name === "ThreadTime").value;
  const t0 = await tt();
  const r = await messe(N);
  r.cpu = ((await tt()) - t0) * 1000 / N;
  console.log(`  tick ${String(ticks).padStart(5)} rennT=${String(r.rennT).padStart(6)} auf Strecke=${String(r.auf).padStart(2)} im Ziel=${String(r.ziel).padStart(2)}  cpu=${r.cpu.toFixed(1).padStart(5)} med=${r.med.toFixed(1).padStart(6)} p95=${r.p95.toFixed(1).padStart(6)} ms  heap=${r.heap} MB  fillRect=${r.cnt.fillRect || 0} stroke=${r.cnt.stroke || 0} fill=${r.cnt.fill || 0} drawImage=${r.cnt.drawImage || 0} fillText=${r.cnt.fillText || 0} measureText=${r.cnt.measureText || 0} save=${r.cnt.save || 0} grad=${(r.cnt.createLinearGradient || 0) + (r.cnt.createRadialGradient || 0)}`);
  if (await seite.evaluate(() => window.__arena.vorbei())) break;
  await seite.evaluate((s) => window.__arena.sondenLauf(s), SCHRITT); ticks += SCHRITT;
}
console.log("Seitenfehler: " + (fehler.length ? fehler.join(" | ") : "keine"));
await browser.close(); server.close();
