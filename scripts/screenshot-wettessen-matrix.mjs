// SICHT-QA-MATRIX WETTESSEN (Uebersichts-Paket 03.11., docs/design/wettessen-uebersicht-format-
// 1v1-03-11.md Abschnitt 5.3): Feldgroesse 2/4/6 je Seite x alle Kulissen (Jahrmarkt/Nachtmarkt/
// Festzelt) x Minute 1/6/10 (+ Nachlauf) -- echte Screenshots des Standalone-Entwurfs
// (public/mockups/battle-mode.html), keine Behauptungen.
//
// Aufruf: node scripts/screenshot-wettessen-matrix.mjs [ausgabeOrdner] [--je-seite=2,4,6]
//         [--kulissen=jahrmarkt,nachtmarkt,bierzelt] [--minuten=1,6,10,ende,guertel] [--saat=N]
//         [--callout-warten=ms] [--echtzeit]
// --echtzeit: ohne sondenLauf, Wanduhr; Minute m faellt 5,3 s nach ihrer Enthuellung, wenn das
// verzoegerte Banner steht (Sonden-Zeit und Echtzeit-Timer vertragen sich nicht, s. unten).
// "ende" = 1,4 s nach der Schlusshupe (Nachzaehlung laeuft), "guertel" = 2,8 s danach (der
// Tagesbeste traegt den Guertel) -- beide in Echtzeit nach window.__arena.sondenAus(), weil der
// Endstand-Nachlauf an der Wanduhr haengt.
//
// Zeit laeuft ueber window.__arena.sondenLauf(ticks) in festen 1/60-s-Schritten (dieselbe Tick-
// Folge wie das Zuschauen, s. dort) -- Minute m ist nach (m-1)*rundenDauer Sekunden enthuellt,
// der Screenshot faellt 2 s spaeter (die Tafeln zaehlen dann schon). Die Kulisse pinnt
// window.__arena.kulisseQa(id) (sonst hasht der Motor Saat+Teams+Spieltag auf eine Variante),
// die Feldgroesse setzt window.__arena.buehneJeSeiteQa(n) -- beides QA-Sonden, s. Motor.
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { existsSync, mkdirSync, createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { sendungsrahmenAus, warteAufAnpfiff } from "./lib/arena-anpfiff.mjs";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fest = path.join(WURZEL, "node_modules", ".cache", "ms-playwright-chromium");
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css",
  ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".json": "application/json",
  ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf", ".webp": "image/webp" };

function starteServer() {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url, "http://localhost");
      const datei = path.join(WURZEL, "public", decodeURIComponent(url.pathname));
      if (!datei.startsWith(path.join(WURZEL, "public")) || !existsSync(datei) || statSync(datei).isDirectory()) {
        res.statusCode = 404; res.end(); return;
      }
      res.setHeader("Content-Type", MIME[path.extname(datei)] || "application/octet-stream");
      createReadStream(datei).pipe(res);
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

const arg = (name, def) => { const a = process.argv.find((x) => x.startsWith("--" + name + "=")); return a ? a.slice(name.length + 3) : def; };
const positional = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const outDir = positional[0] || path.join(WURZEL, "tmp-ux-audit", "wettessen-matrix");
const jeSeiten = arg("je-seite", "2,4,6").split(",").map(Number);
const kulissen = arg("kulissen", "jahrmarkt,nachtmarkt,bierzelt").split(",");
const minuten = arg("minuten", "1,6,10,ende").split(",");
const saat = Number(arg("saat", "7"));
const calloutWarten = Number(arg("callout-warten", "0"));
const ECHTZEIT = process.argv.includes("--echtzeit");
const RUNDEN_DAUER = 6; // BUEHNE_ART.wettessen.rundenDauer = 60/10
mkdirSync(outDir, { recursive: true });

const server = await starteServer();
const SEITE = `http://127.0.0.1:${server.address().port}/mockups/battle-mode.html`;
let browser;
try {
  browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
  const seite = await browser.newPage({ viewport: { width: 1300, height: 700 } });
  const fehler = [];
  seite.on("pageerror", (e) => fehler.push(String(e)));
  for (const je of jeSeiten) for (const kul of kulissen) {
    await seite.goto(SEITE, { waitUntil: "networkidle" });
    await seite.waitForFunction(() => window.__arena && window.__arena.setDisc, null, { timeout: 30000 });
    await seite.evaluate((s) => { window.__arena.setDisc("wettessen"); if (window.__arena.saat) window.__arena.saat(s); }, saat);
    await seite.evaluate((n) => window.__arena.buehneJeSeiteQa(n), je);
    // Kulisse pinnen (ueberlebt den reset() beim Anpfiff, s. kulisseQa im Motor).
    const gewaehlt = await seite.evaluate((id) => window.__arena.kulisseQa(id), kul);
    if (!gewaehlt || gewaehlt.id !== kul) { console.error("Kulisse " + kul + " nicht gefunden (" + JSON.stringify(gewaehlt) + ")"); continue; }
    await seite.click("#t2");
    await sendungsrahmenAus(seite, { countdown: true, finale: true, nachlauf: false });
    await seite.click("#play");
    await warteAufAnpfiff(seite);
    // Figuren/Kulisse muessen geladen sein, sonst wartet der Anpfiff (ANPFIFF ERST MIT FIGUREN).
    await seite.waitForFunction(() => { const f = window.__arena.figurenStand && window.__arena.figurenStand(); return !f || f.laeuft; }, null, { timeout: 60000 }).catch(() => {});
    let simSek = 0;
    const laufBis = async (zielSek) => {
      const ticks = Math.max(0, Math.round((zielSek - simSek) * 60));
      if (ticks > 0) await seite.evaluate((t) => window.__arena.sondenLauf(t), ticks);
      simSek = Math.max(simSek, zielSek);
      await seite.waitForTimeout(250);
    };
    let echtzeitSeit = null;
    if (ECHTZEIT) {
      // ECHTZEIT-MODUS: kein sondenLauf, die Wanduhr laeuft -- Minute m wird 5,3 s nach ihrer
      // Enthuellung fotografiert, genau wenn das (um 0,8 x rundenDauer verzoegerte) Banner steht.
      await seite.evaluate(() => window.__arena.sondenAus());
      echtzeitSeit = Date.now();
      for (const m of minuten) {
        const zielMs = m === "ende" ? 10 * RUNDEN_DAUER * 1000 + 1600
          : m === "guertel" ? 10 * RUNDEN_DAUER * 1000 + 3000
          : ((Number(m) - 1) * RUNDEN_DAUER + 5.3) * 1000;
        const rest = zielMs - (Date.now() - echtzeitSeit);
        if (rest > 0) await seite.waitForTimeout(rest);
        const cv = await seite.$("#cv");
        const name = `we-${je}v${je}-${kul}-min${m}-echtzeit.png`;
        await cv.screenshot({ path: path.join(outDir, name) });
        const stand = await seite.evaluate(() => ({ clock: document.getElementById("clock")?.textContent, callout: document.getElementById("bbugcallout")?.hidden ? "" : document.getElementById("bbugcallout")?.textContent?.slice(0, 90) }));
        console.log(name, JSON.stringify(stand));
      }
      continue;
    }
    for (const m of minuten) {
      if (m === "ende" || m === "guertel") {
        // Bis kurz vor die Hupe in Sonden-Zeit, dann Wanduhr (Nachlauf/Nachzaehlung sind Echtzeit).
        await laufBis(10 * RUNDEN_DAUER - 0.2);
        if (echtzeitSeit == null) { await seite.evaluate(() => window.__arena.sondenAus()); echtzeitSeit = Date.now(); }
        const zielMs = (m === "ende" ? 1400 : 2800) + 200;
        const rest = zielMs - (Date.now() - echtzeitSeit);
        if (rest > 0) await seite.waitForTimeout(rest);
      } else {
        await laufBis((Number(m) - 1) * RUNDEN_DAUER + 2);
        // Banner kommen seit PR 3 um 0,8 x rundenDauer verzoegert (Echtzeit-Timer in feed()) --
        // wer sie im Bild haben will, wartet hier (--callout-warten=5000).
        if (calloutWarten > 0) await seite.waitForTimeout(calloutWarten);
      }
      const cv = await seite.$("#cv");
      const name = `we-${je}v${je}-${kul}-min${m}.png`;
      await cv.screenshot({ path: path.join(outDir, name) });
      const stand = await seite.evaluate(() => ({ clock: document.getElementById("clock")?.textContent, score: document.getElementById("score")?.textContent, callout: document.getElementById("bbugcallout")?.textContent?.slice(0, 80), bug: document.getElementById("bbugMitte")?.textContent }));
      console.log(name, JSON.stringify(stand));
    }
  }
  console.log("Seitenfehler: " + (fehler.length ? fehler.join(" | ") : "keine"));
} finally {
  if (browser) await browser.close();
  server.close();
}
