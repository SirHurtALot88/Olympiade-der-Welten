// VERIFIKATION SCHACH/FECHTEN-TICKER-PAKET (07.10., Nachbarfund zum Time-Trial-Broadcast-
// Paket, docs/design/time-trial-broadcast-paket-plan-07-10.md): dieselbe kind-Falle wie bei
// TDM (PR #1157), Breaking (PR #1158) und Time-Trial (PR #1159) steckte noch in der
// gemeinsamen Duell-Aufrufstelle (Schach/Fechten/Tennis, BB().duell-Zweig in bauBuehne()'s
// Enthuellungsschleife) -- `kind` stand fuer Schach ("kippZug") und Fechten
// ("fuehrungswechsel") bedingungslos da, nur Tennis war am 04.10. (T-N1) schon auf `kind`
// nur bei `zeileBig` umgestellt. Jetzt disziplinuebergreifend: `kind` nur noch, wenn
// `zeileBig` -- also exakt dann, wenn auch das Banner steht.
//
// Prueft:
//   (a) Ticker-Dichte: Schach und Fechten liegen jetzt unter der 30er-Schranke (vorher
//       129,7 bzw. 72,4 je Minute), Tennis bleibt unveraendert (19,4 je Minute, Regressions-
//       schutz fuer den bereits bestehenden Fix).
//   (b) der `if(big)`-Zweig bleibt unberuehrt: mindestens eine "KIPP-ZUG"-Bannerzeile fuer
//       Schach und mindestens eine "FUEHRUNGSWECHSEL"-aehnliche Bannerzeile fuer Fechten
//       stehen weiterhin im Ticker -- T1 darf das Banner selbst nicht abschalten, nur den
//       stillen `kind`-Normalfall.
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

const SCHRANKEN = { "speed-schach": 30, fechten: 30, tennis: 30 };
// Erwartete Groessenordnung je Disziplin (gemessen auf dieser Engine-Version, Standardkader) --
// kein strenger Diff wie bei den Bahn-Paketen, nur ein grober Regressionsschutz: Tennis darf
// durch diese Aenderung ueberhaupt nicht wandern (die zeileBig-Bedingung war dort schon vorher
// dieselbe), Schach/Fechten muessen klar unter ihre alten Werte (129,7 / 72,4) fallen.
const ERWARTET = { "speed-schach": { max: 30, tennisGleich: false }, fechten: { max: 30 }, tennis: { max: 30, exakt: 19.4 } };
const MAX_TICKS = 60 * 60 * 10;
const SCHRITT = 60;

let alleOk = true;
const server = await starteServer();
const SEITE = `http://127.0.0.1:${server.address().port}/mockups/battle-mode.html`;
let browser;
try {
  browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
  for (const disc of ["speed-schach", "fechten", "tennis"]) {
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
    const minuten = ticks / 60 / 60;
    const jeMin = z.feed.length / minuten;

    const schranke = SCHRANKEN[disc];
    const aOk = jeMin <= schranke;
    console.log(`(a) ${disc}: ${z.feed.length} Zeilen in ${ticks / 60}s = ${jeMin.toFixed(1)}/min (Schranke ${schranke}) -> ${aOk ? "OK" : "FEHLER"}`);
    if (!aOk) alleOk = false;

    if (disc === "speed-schach") {
      const bOk = z.feed.some((f) => /KIPP-ZUG/.test(f.txt) || f.big);
      console.log(`(b) ${disc}: mindestens ein Banner (KIPP-ZUG o.ae. big) im Ticker: ${bOk} -> ${bOk ? "OK" : "FEHLER"}`);
      if (!bOk) alleOk = false;
    }
    if (disc === "fechten") {
      const bOk = z.feed.some((f) => f.big);
      console.log(`(b) ${disc}: mindestens ein big-Banner im Ticker: ${bOk} -> ${bOk ? "OK" : "FEHLER"}`);
      if (!bOk) alleOk = false;
    }
    if (disc === "tennis") {
      // Regressionsschutz: Tennis war durch diese Aenderung nicht betroffen (zeileBig war
      // dort schon vorher die Bedingung) -- derselbe Wert wie vor dem Schach/Fechten-Fix.
      const cOk = Math.abs(jeMin - ERWARTET.tennis.exakt) < 1.0;
      console.log(`(c) tennis unveraendert: ${jeMin.toFixed(1)} ~ ${ERWARTET.tennis.exakt} -> ${cOk ? "OK" : "FEHLER"}`);
      if (!cOk) alleOk = false;
    }

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
