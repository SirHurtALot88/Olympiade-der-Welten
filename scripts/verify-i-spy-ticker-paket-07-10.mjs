// VERIFIKATION I-SPY-TICKER-PAKET (07.10.): dieselbe kind-Falle wie bei TDM/Breaking/
// Time-Trial/Schach/Fechten/Takeshi -- kind stand in der Enthuellungs-Zeile bedingungslos auf
// "tresor" ODER "fuehrungswechsel" (nie undefined), feed() stuft jede Zeile mit gesetztem kind
// immer als "ereignis" ein, unabhaengig vom stufe="routine" direkt darunter -- das liess jede
// Untersuchung (Erfolg wie Fehlschlag) ungebremst durch (95,4 statt <=30 Zeilen/min). Fix:
// kind nur noch, wenn tatsaechlich big (versuchBig||fuehrungswechsel).
//
// Prueft:
//   (a) Ticker-Dichte <= 30/min (vorher 95,4).
//   (b) jede erfolglose Untersuchung ("übersieht das Detail"/"scheitert") steht NICHT im
//       sichtbaren Ticker (routine, nur Protokoll).
//   (c) mindestens ein Fund ("entdeckt den Hinweis") steht weiterhin im Ticker.
//   (d) keine `pageerror`
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { existsSync, createReadStream, statSync } from "node:fs";
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
        res.writeHead(200, { "Content-Type": MIME[path.extname(p)] || "application/octet-stream" });
        createReadStream(p).pipe(res);
      } catch { res.writeHead(404); res.end("not found"); }
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

const TICKER_SCHRANKE_JE_MIN = 30;
const MAX_TICKS = 60 * 60 * 10;
const SCHRITT = 60;

let alleOk = true;
const server = await starteServer();
const SEITE = `http://127.0.0.1:${server.address().port}/mockups/battle-mode.html`;
let browser;
try {
  browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
  const seite = await browser.newPage({ viewport: { width: 1300, height: 900 } });
  const fehler = [];
  seite.on("pageerror", (e) => fehler.push(String(e)));
  await seite.goto(SEITE, { waitUntil: "networkidle" });
  await seite.evaluate(() => {
    document.documentElement.setAttribute("data-theme", "dark");
    document.querySelector(".oly-battle-arena")?.setAttribute("data-theme", "dark");
    document.querySelector(".oly-battle-arena")?.classList.add("im-spiel");
  });
  await seite.waitForFunction(() => window.__arena && window.__arena.setDisc && window.__arena.sondenLauf, null, { timeout: 30000 });
  await seite.evaluate(() => window.__arena.setDisc("i-spy"));
  await seite.click("#t2").catch(() => {});
  await seite.evaluate(() => {
    const zeile = (n) => ({ txt: n.textContent, big: !!n.querySelector(".big") });
    window.__tickerZaehler = { feed: [], prot: [] };
    const beobachte = (id, ziel) => {
      const box = document.getElementById(id);
      if (!box) return;
      new MutationObserver((ms) => {
        for (const m of ms) for (const n of m.addedNodes) {
          if (n.nodeType !== 1 || !n.querySelector || !n.querySelector(".tk")) continue;
          if (n.classList.contains("tkmehr")) continue;
          ziel.push(zeile(n));
        }
      }).observe(box, { childList: true, subtree: true });
    };
    beobachte("feed", window.__tickerZaehler.feed);
    beobachte("protokoll", window.__tickerZaehler.prot);
  });
  let ticks = 0, fertig = false;
  while (ticks < MAX_TICKS && !fertig) {
    await seite.evaluate((n) => window.__arena.sondenLauf(n), SCHRITT);
    ticks += SCHRITT;
    fertig = await seite.evaluate(() => !document.getElementById("endstand").hidden);
  }
  await seite.waitForTimeout(300);
  const z = await seite.evaluate(() => ({ feed: window.__tickerZaehler.feed, prot: window.__tickerZaehler.prot }));
  const minuten = ticks / 60 / 60;
  const jeMin = z.feed.length / minuten;

  const aOk = jeMin <= TICKER_SCHRANKE_JE_MIN;
  console.log(`(a) Ticker ${jeMin.toFixed(1)}/min (Schranke ${TICKER_SCHRANKE_JE_MIN}), ${z.feed.length} Zeilen in ${(ticks / 60).toFixed(0)}s -> ${aOk ? "OK" : "FEHLER"}`);
  if (!aOk) alleOk = false;

  const fehlschlagImTicker = z.feed.filter((f) => /übersieht das Detail|scheitert/.test(f.txt));
  const bOk = fehlschlagImTicker.length === 0;
  console.log(`(b) Fehlschlag-Zeilen im Ticker: ${fehlschlagImTicker.length} (muss 0 sein) -> ${bOk ? "OK" : "FEHLER"}`);
  if (!bOk) alleOk = false;

  const fundImTicker = z.feed.filter((f) => /entdeckt den Hinweis/.test(f.txt));
  const cOk = fundImTicker.length > 0;
  console.log(`(c) Fund-Zeilen im Ticker: ${fundImTicker.length} (muss >0 sein) -> ${cOk ? "OK" : "FEHLER"}`);
  if (!cOk) alleOk = false;

  const dOk = fehler.length === 0;
  console.log(`(d) Seitenfehler: ${dOk ? "keine" : fehler.join(" | ")} -> ${dOk ? "OK" : "FEHLER"}`);
  if (!dOk) alleOk = false;

  await seite.close();
} finally {
  if (browser) await browser.close();
  server.close();
}

console.log(`\n=== GESAMT: ${alleOk ? "ALLE PRUEFUNGEN BESTANDEN" : "MINDESTENS EINE PRUEFUNG FEHLGESCHLAGEN"} ===`);
process.exit(alleOk ? 0 : 1);
