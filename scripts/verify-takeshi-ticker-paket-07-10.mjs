// VERIFIKATION TAKESHI-TICKER-PAKET (07.10., docs/design/takeshi-ticker-paket-plan-07-10.md):
// zwei kind/stufe-Inkonsistenzen in stepSpurt() behoben -- T-REMPLER (kind="rempler" lief
// bedingungslos, dieselbe kind-Falle wie bei TDM/Breaking/Time-Trial/Schach/Fechten) und
// T-STURZ ("X reisst die Falle" war "normal" statt "routine", anders als der Durchbruch-
// Zwilling "nimmt die Falle mit Gewalt"). WICHTIG: dieses Paket bringt Takeshi NICHT unter die
// 30er-Ticker-Schranke (bleibt bei 31,5/min, strukturell bedingt durch 16 erzwungene
// Ereignis-Zeilen in einem 61s-Rennen, s. Plan Abschnitt "Warum die Gesamtzahl trotzdem bei
// 31,5 bleibt") -- die Sonde prueft deshalb NICHT auf eine Schranke, sondern auf die beiden
// tatsaechlich behobenen Inkonsistenzen:
//
//   (a) "reisst die Falle"/"greift daneben" steht NIE MEHR im sichtbaren Ticker (nur noch im
//       Protokoll) -- fuer Takeshi, Spurt UND Climbing (eine Aufrufstelle fuer alle drei).
//   (b) "rammt ... um" ist fuer Takeshi nicht mehr erzwungen: vorher liess die kind-Falle
//       praktisch jeden Treffer durch (kind="rempler" bedingungslos), jetzt nur noch, wenn
//       das Zeilenbudget gerade Platz hat -- Ticker-Zahl bleibt also klar UNTER der
//       Protokoll-Zahl. Fuer Spurt (big=true, unveraendert) bleiben Ticker- und Protokoll-
//       Zahl weiterhin gleich (jeder Treffer dort ist ein echtes Banner, kein Budget-Fall).
//   (c) keine `pageerror`
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

const MAX_TICKS = 60 * 60 * 10;
const SCHRITT = 60;

let alleOk = true;
const server = await starteServer();
const SEITE = `http://127.0.0.1:${server.address().port}/mockups/battle-mode.html`;
let browser;
try {
  browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
  for (const disc of ["takeshis-castle", "spurt", "climbing"]) {
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
    await seite.evaluate((d) => window.__arena.setDisc(d), disc);
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

    // (a) "reisst die Falle"/"greift daneben" nie im Ticker
    const sturzImFeed = z.feed.filter((f) => /reißt die|greift daneben/.test(f.txt));
    const sturzImProt = z.prot.filter((f) => /reißt die|greift daneben/.test(f.txt));
    const aOk = sturzImFeed.length === 0;
    console.log(`(a) ${disc}: Sturz-Zeilen im Ticker: ${sturzImFeed.length} (im Protokoll: ${sturzImProt.length}) -> ${aOk ? "OK" : "FEHLER"}`);
    if (!aOk) alleOk = false;

    // (b) Takeshi: Rempler nicht mehr erzwungen -- Ticker-Zahl klar unter Protokoll-Zahl
    //     (vorher liess kind="rempler" bedingungslos praktisch jeden Treffer durch).
    //     Spurt: big=true unveraendert, Ticker- und Protokoll-Zahl bleiben gleich.
    const remplerImFeed = z.feed.filter((f) => /rammt .* vor der|räumt .* von der Bahn/.test(f.txt));
    const remplerImProt = z.prot.filter((f) => /rammt .* vor der|räumt .* von der Bahn/.test(f.txt));
    let bOk;
    if (disc === "takeshis-castle") {
      bOk = remplerImProt.length > 0 && remplerImFeed.length < remplerImProt.length;
      console.log(`(b) ${disc}: Rempler im Ticker: ${remplerImFeed.length}, im Protokoll: ${remplerImProt.length} (Ticker muss kleiner sein -- nicht mehr erzwungen) -> ${bOk ? "OK" : "FEHLER"}`);
    } else if (disc === "spurt") {
      bOk = remplerImProt.length === 0 || remplerImFeed.length === remplerImProt.length;
      console.log(`(b) ${disc}: Rempler im Ticker: ${remplerImFeed.length}, im Protokoll: ${remplerImProt.length} (muessen gleich sein, big=true unveraendert) -> ${bOk ? "OK" : "FEHLER"}`);
    } else {
      bOk = true; // climbing hat kein tackle:true
    }
    if (!bOk) alleOk = false;

    const fOk = fehler.length === 0;
    console.log(`    Seitenfehler (${disc}): ${fOk ? "keine" : fehler.join(" | ")} -> ${fOk ? "OK" : "FEHLER"}`);
    if (!fOk) alleOk = false;

    await seite.close();
  }
} finally {
  if (browser) await browser.close();
  server.close();
}

console.log(`\n=== GESAMT: ${alleOk ? "ALLE PRUEFUNGEN BESTANDEN" : "MINDESTENS EINE PRUEFUNG FEHLGESCHLAGEN"} ===`);
process.exit(alleOk ? 0 : 1);
