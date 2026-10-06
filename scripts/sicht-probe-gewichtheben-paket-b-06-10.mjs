// SICHTPROBE BROADCAST-SENDUNGSRHYTHMUS PAKET B (06.10.): spielt Gewichtheben in ECHTZEIT bei
// Tempo 4x (echter RAF-Loop ueber #play/#spd, NICHT sondenLauf) und sammelt Screenshots fuer
// die manuelle Sichtpruefung aus dem Auftrag:
//   - Bauchbinde (B2) bei jedem der sechs Duellwechsel
//   - Zwischenstand (B3) nach jedem Reissen-Block
//   - Versuchsuhr (B1) wird NIE vom #bbugcallout-Banner verdeckt
//   - Versuchstafel bleibt vollstaendig im Canvas
//
// Die Lower-Third-Flaeche (B2/B3) wird NICHT ueber internen Spielzustand erkannt (kein neuer
// Debug-Zugriff auf TEILNEHMER/duellNr noetig), sondern ueber eine duenne Pixelzeile GENAU an
// der oberen Gold-Umrandung der Box (boxY0=H*0.805, s. zeichneHeben() in der Engine) --
// `ctx.getImageData()` auf demselben Canvas-Context, den die Engine selbst benutzt (liest nur,
// schreibt nichts). Ein Goldton (hohes R, mittleres G, niedriges B) an dieser Stelle heisst:
// gerade zeigt B2 oder B3 etwas an.
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { existsSync, mkdirSync, createReadStream, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = path.join(WURZEL, "public");
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png" };

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
      } catch { res.writeHead(404); res.end("not found: " + p); }
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

const OUT = path.join(WURZEL, "tmp-ux-audit", "gewichtheben-sichtprobe-paket-b-06-10");
mkdirSync(OUT, { recursive: true });
const server = await starteServer();
const port = server.address().port;
const SEITE = `http://127.0.0.1:${port}/mockups/battle-mode.html`;

const maxArg = process.argv.find((a) => a.startsWith("--max-sek="));
const MAX_SEK = maxArg ? Number(maxArg.split("=")[1]) : 130; // 4x-Spiel dauert ~112s

let browser;
try {
  browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
  const seite = await browser.newPage({ viewport: { width: 1300, height: 900 } });
  const fehler = [];
  seite.on("pageerror", (e) => fehler.push(String(e)));
  await seite.goto(SEITE, { waitUntil: "networkidle" });
  await seite.waitForFunction(() => window.__arena && window.__arena.setDisc, null, { timeout: 30000 });
  await seite.evaluate(() => window.__arena.setDisc("gewichtheben"));
  await seite.click("#t2");
  await seite.click("#play");
  await seite.click("#spd"); // 2x
  await seite.click("#spd"); // 4x
  console.log("Tempo: " + await seite.$eval("#spd", (e) => e.textContent.trim()));

  const arenaraum = await seite.$(".arenaraum");

  // GOLD-STREIFEN-SONDE: liest eine 1px hohe Zeile direkt an der oberen Kante der B2/B3-Box
  // (boxY0 in Canvas-Koordinaten, s. zeichneHeben()) ueber denselben Canvas-Context, den die
  // Engine zeichnet -- reines Lesen von Pixeln, kein Eingriff in den Spielzustand.
  const goldStreifen = () => seite.evaluate(() => {
    const cv = document.getElementById("cv");
    const ctx = cv.getContext("2d");
    const y = Math.round(cv.height * 0.806); // knapp innerhalb der oberen Gold-Umrandung
    const row = ctx.getImageData(0, y, cv.width, 1).data;
    let goldPixel = 0;
    for (let x = 0; x < cv.width; x++) {
      const o = x * 4;
      const r = row[o], g = row[o + 1], b = row[o + 2];
      if (r > 140 && g > 100 && b < 110 && r > b + 60) goldPixel++;
    }
    return goldPixel;
  });

  let warVorherSichtbar = false;
  let ereignisNr = 0;
  const log = [];
  const start = Date.now();
  while ((Date.now() - start) / 1000 < MAX_SEK) {
    await seite.waitForTimeout(400);
    const gold = await goldStreifen();
    const sichtbarJetzt = gold > 20; // mehr als ein paar vereinzelte Pixel
    const scoreTxt = await seite.$eval("#score", (e) => e.textContent.trim()).catch(() => "");
    const sek = ((Date.now() - start) / 1000).toFixed(1);
    if (sichtbarJetzt && !warVorherSichtbar) {
      ereignisNr++;
      const out = path.join(OUT, `b2-b3-ereignis-${String(ereignisNr).padStart(2, "0")}-${sek}s-score-${scoreTxt.replace(/[^0-9:]/g, "")}.png`);
      await arenaraum.screenshot({ path: out });
      log.push({ ereignisNr, sek, scoreTxt, out, goldPixel: gold });
      console.log(`Ereignis ${ereignisNr} bei ${sek}s, Score "${scoreTxt}", ${gold} Gold-Pixel -> ${out}`);
    }
    warVorherSichtbar = sichtbarJetzt;
    const phase = await seite.$eval("#phase", (e) => e.textContent).catch(() => "");
    if (phase === "beendet") { console.log(`Spiel beendet bei ${sek}s.`); break; }
  }
  console.log(`\nGesamt B2/B3-Ereignisse erkannt: ${ereignisNr}`);

  // B1: Versuchsuhr vs. Banner -- Callout waehrend eines laufenden Versuchs erzwingen
  // (calloutProbe(), dieselbe Testschnittstelle wie bei anderen Disziplinen schon genutzt,
  // s. battle-mode.engine.js window.__arena) und dann die Anzeigetafel fotografieren.
  await seite.evaluate(() => window.__arena.calloutProbe("SICHTPROBE: Banner ueber der Buehne", "Testet, ob die Versuchsuhr (Anzeigetafel oben rechts) verdeckt wird."));
  await seite.waitForTimeout(150);
  const bannerShot = path.join(OUT, "b1-banner-vs-versuchsuhr.png");
  await arenaraum.screenshot({ path: bannerShot });
  console.log(`B1-Sichtprobe (Banner + Versuchsuhr): ${bannerShot}`);

  // Versuchstafel-Rand: ein Nahaufnahme-Screenshot der Anzeigetafel-Ecke (oben rechts), um
  // visuell zu pruefen, dass nichts ueber den Canvas-Rand hinaus abgeschnitten wird.
  const tafelEckeShot = path.join(OUT, "b1-versuchstafel-ecke.png");
  const box = await arenaraum.boundingBox();
  if (box) {
    await seite.screenshot({ path: tafelEckeShot, clip: { x: box.x + box.width * 0.78, y: box.y, width: box.width * 0.22, height: box.height * 0.45 } });
    console.log(`Versuchstafel-Ecke: ${tafelEckeShot}`);
  }

  writeFileSync(path.join(OUT, "ereignisse.json"), JSON.stringify(log, null, 2));
  console.log(`Seitenfehler: ${fehler.length ? fehler.join(" | ") : "keine"}`);
} finally {
  if (browser) await browser.close();
  server.close();
}
