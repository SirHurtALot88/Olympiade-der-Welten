import { chromium } from "playwright";
import { createReadStream, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
const PUBLIC = path.join(process.argv[2], "public");
const OUT = process.argv[3];
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".webp": "image/webp" };
const server = await new Promise((resolve) => {
  const s = createServer((req, res) => {
    let p = path.join(PUBLIC, decodeURIComponent(new URL(req.url, "http://x").pathname));
    try { if (statSync(p).isDirectory()) p = path.join(p, "index.html");
      res.writeHead(200, { "Content-Type": MIME[path.extname(p)] || "application/octet-stream" }); createReadStream(p).pipe(res);
    } catch { res.writeHead(404); res.end(); }
  });
  s.listen(0, "127.0.0.1", () => resolve(s));
});
const browser = await chromium.launch({});
try {
  for (const an of [false, true]) {
    const seite = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    const fehler = []; seite.on("pageerror", (e) => fehler.push(String(e)));
    await seite.goto(`http://127.0.0.1:${server.address().port}/mockups/battle-mode.html`, { waitUntil: "networkidle" });
    await seite.waitForFunction(() => window.__arena && window.__arena.mdffaBuehneStand, null, { timeout: 30000 });
    await seite.evaluate((an) => { window.__arena.mdffaBewegung(an); window.__arena.setDisc("mini-dm"); }, an);
    await seite.waitForTimeout(1500);
    await seite.click("#t2"); await seite.waitForTimeout(1500);
    await seite.click("#mdffaStart");
    const proben = await seite.evaluate(async () => {
      const aus = []; const t0 = performance.now();
      while (performance.now() - t0 < 16000) { aus.push({ t: performance.now() - t0, s: window.__arena.mdffaBuehneStand() }); await new Promise((r) => setTimeout(r, 50)); }
      return aus;
    });
    const url = await seite.evaluate(() => document.getElementById("mdffaCv").toDataURL("image/png"));
    writeFileSync(`${OUT}-${an ? "nachher" : "vorher"}.png`, Buffer.from(url.split(",")[1], "base64"));
    // Auswertung: nur Proben mit Kaempfern
    const mit = proben.filter((p) => p.s);
    let ruhe = 0, laengsteRuhe = 0, lauf = 0, angriff = 0, n = 0, weg = 0, minAbst = 0;
    for (let i = 1; i < mit.length; i++) {
      const a = mit[i - 1].s, b = mit[i].s, dt = (mit[i].t - mit[i - 1].t) / 1000;
      const leb = b.filter((k) => !k.raus);
      const bew = b.reduce((m, k, j) => Math.max(m, k.raus ? 0 : Math.hypot(k.x - a[j].x, k.y - a[j].y)), 0);
      weg += b.reduce((m, k, j) => m + Math.hypot(k.x - a[j].x, k.y - a[j].y), 0) / 4;
      n++;
      if (bew < 1) { ruhe += dt; lauf += dt; laengsteRuhe = Math.max(laengsteRuhe, lauf); } else lauf = 0;
      if (b.some((k) => k.angriff)) angriff++;
      let m = Infinity; for (const x of leb) for (const y of leb) if (x !== y) m = Math.min(m, Math.hypot(x.x - y.x, x.y - y.y));
      if (isFinite(m)) minAbst += m;
    }
    const dauer = (mit.at(-1).t - mit[0].t) / 1000;
    let zeile = "";
    for (let i = 1; i < proben.length; i += 5) { const a = proben[i - 1].s, b = proben[i].s; if (!b) { zeile += "_"; continue; }
      const bew = a ? b.some((k, j) => !k.raus && Math.hypot(k.x - a[j].x, k.y - a[j].y) >= 1) : false;
      zeile += b.some((k) => k.angriff) ? "A" : bew ? "m" : "."; }
    console.log("Zeitleiste (je 0,25 s; _ keine Kaempfer, A Angriff, m Bewegung, . Stillstand):", zeile);
    console.log(JSON.stringify({ bewegung: an, sekundenMitKaempfern: +dauer.toFixed(1), ruheSek: +ruhe.toFixed(1), ruheAnteil: +(ruhe / dauer).toFixed(3),
      laengsteRuheSek: +laengsteRuhe.toFixed(2), anteilProbenMitAngriff: +(angriff / n).toFixed(3), wegJeFigurPx: Math.round(weg),
      mittlererKleinsterAbstandPx: Math.round(minAbst / n), fehler }));
    await seite.close();
  }
} finally { await browser.close(); server.close(); }
