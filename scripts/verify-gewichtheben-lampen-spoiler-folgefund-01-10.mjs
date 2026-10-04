// SICHTPRUEFUNG fuer Task #35 (Folgefund zu PR #1091, 01.10.): "Gewichtheben: weitere
// Pre-Lampen-Spoiler-Stellen". Kein Teil der Abnahme-Sonden (rho/Pp) -- die laufen mit
// `stumm=true` und sehen keine Anzeige-Logik ueberhaupt; dieses Skript prueft stattdessen
// GENAU die Zeitachse, auf der ein Zuschauer den Spoiler saehe.
//
// WAS GEMESSEN WIRD: den Abstand zwischen zwei Momenten je Versuch,
//   1. ENTHUELLUNG   -- stepBuehne() erhoeht u.aktuell und setzt `letzterHebenZug` (der
//                        Moment, in dem der Versuch im Motor als "dran" gilt).
//   2. LAMPEN-MOMENT -- stepHeben() laesst die Phase "antritt"/"zug" hinter sich (Uebergang
//                        zu "hoch"/"ablage"), GENAU der Frame, in dem Kampfrichterlampen,
//                        Versuchstafel und Team-Feier (hebenFeierAmUrteil()) umschalten.
// Vor dem Fix schrieb der Haupt-Ticker (`feed()`, "... — gueltig/ungueltig") UND der kg/X-
// Schweber schon bei (1); nach dem Fix (hebenTickerAmUrteil(), aufgerufen aus stepHeben() an
// GENAU derselben Stelle wie hebenFeierAmUrteil()) erst bei (2).
//
// ZWEI AUFRUFARTEN:
//   node scripts/verify-gewichtheben-lampen-spoiler-folgefund-01-10.mjs vorher <html-pfad>
//     -- liest `window.__sondeEnthuellt`/`window.__sondeLampe`. Diese zwei Variablen gibt es
//     NICHT im echten Produktionscode; sie stehen nur in einer Wegwerf-Kopie des VORHER-
//     Stands (sonst identisch mit `origin/main`), die exakt an den beiden oben genannten
//     Stellen eine zusaetzliche, rein lesende `window.__sonde*`-Zeile traegt, um von aussen
//     sichtbar zu machen, was vorher nur im Motor steckte. Diese Kopie ist NICHT Teil des
//     Commits/der PR.
//   node scripts/verify-gewichtheben-lampen-spoiler-folgefund-01-10.mjs nachher [html-pfad]
//     -- liest stattdessen `window.__arena.hebenZustand()` (den echten, committeten Read-Only-
//     Accessor, s. Kommentar dort), ohne jede Instrumentierung.
//
// In beiden Faellen zusaetzlich: `#feed`-Zeilenzahl/letzter Text, um zu zeigen, DASS der
// sichtbare Ticker selbst (nicht nur die interne Sonde) den Unterschied macht.
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { existsSync, createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };

const MODUS = process.argv[2] || "nachher";
if (MODUS !== "vorher" && MODUS !== "nachher") {
  console.error("Aufruf: node " + path.basename(process.argv[1]) + " vorher|nachher [html-pfad] [ticks]");
  process.exit(1);
}
const htmlPfad = process.argv[3]
  ? path.resolve(process.argv[3])
  : path.join(WURZEL, "public/mockups/battle-mode.html");
const PUBLIC = path.dirname(htmlPfad);
const TICKS = Number(process.argv[4] || 2400); // 40s Sim-Zeit bei 60 Ticks/s

function starteServer() {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url, "http://localhost");
      let p = path.join(PUBLIC, decodeURIComponent(url.pathname === "/" ? "/battle-mode.html" : url.pathname));
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

const server = await starteServer();
const SEITE = `http://127.0.0.1:${server.address().port}/${path.basename(htmlPfad)}`;
let browser;
try {
  browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
  const seite = await browser.newPage({ viewport: { width: 1300, height: 900 } });
  const fehler = [];
  seite.on("pageerror", (e) => fehler.push(String(e)));
  await seite.goto(SEITE, { waitUntil: "networkidle" });
  // PRODUKTIONSMODUS (wie im Host): data-theme="dark" + .im-spiel, dasselbe Muster wie
  // verify-ticker-protokoll-01-10.mjs/PR #1091s eigene Playwright-Verifikation.
  await seite.addStyleTag({ content: "body{background:#0B1018}" });
  await seite.evaluate(() => {
    document.documentElement.setAttribute("data-theme", "dark");
    document.querySelector(".oly-battle-arena")?.setAttribute("data-theme", "dark");
    document.querySelector(".oly-battle-arena")?.classList.add("im-spiel");
  });
  await seite.waitForFunction(() => window.__arena && window.__arena.setDisc, null, { timeout: 30000 });
  await seite.evaluate(() => window.__arena.setDisc("gewichtheben"));
  await seite.click("#t2");

  const zeilen = [];
  let letzterEnthuelltSchluessel = null;
  let letzterLampeSchluessel = null;
  let letzteFeedZeile = "";

  const schluessel = (z) => z ? `${z.n}|${z.uebung}|${z.versuch}` : null;

  for (let tick = 0; tick < TICKS; tick++) {
    await seite.evaluate(() => window.__arena.sondenLauf(1));
    const stand = await seite.evaluate((modus) => {
      const z = modus === "vorher"
        ? { enthuellt: window.__sondeEnthuellt || null, lampe: window.__sondeLampe || null }
        : window.__arena.hebenZustand();
      const feed = document.getElementById("feed");
      const letzte = feed && feed.lastElementChild ? feed.lastElementChild.textContent : "";
      return { ...z, feedN: feed ? feed.children.length : 0, letzteFeedZeile: letzte };
    }, MODUS);

    const sEnt = schluessel(stand.enthuellt);
    const sLam = schluessel(stand.lampe);
    if (sEnt && sEnt !== letzterEnthuelltSchluessel) {
      letzterEnthuelltSchluessel = sEnt;
      zeilen.push({ tick, ereignis: "ENTHUELLUNG", wer: stand.enthuellt.n,
        uebung: stand.enthuellt.uebung, versuch: stand.enthuellt.versuch,
        gueltig: stand.enthuellt.gueltig, ereignisText: stand.enthuellt.ereignis });
    }
    if (sLam && sLam !== letzterLampeSchluessel) {
      letzterLampeSchluessel = sLam;
      zeilen.push({ tick, ereignis: "LAMPE", wer: stand.lampe.n,
        uebung: stand.lampe.uebung, versuch: stand.lampe.versuch,
        gueltig: stand.lampe.gueltig, ereignisText: stand.lampe.ereignis });
    }
    if (stand.letzteFeedZeile && stand.letzteFeedZeile !== letzteFeedZeile) {
      letzteFeedZeile = stand.letzteFeedZeile;
      zeilen.push({ tick, ereignis: "TICKER", wer: "", uebung: "", versuch: "",
        gueltig: null, ereignisText: stand.letzteFeedZeile });
    }
    // Nach 8 vollstaendigen Duellen (Enthuellung+Lampe je Versuch beobachtet) reicht es --
    // frueher abbrechen spart Laufzeit, 2400 Ticks (40s Sim-Zeit) decken ohnehin das ganze
    // erste Duell plus einen Teil des zweiten ab.
  }

  console.log(`Modus: ${MODUS} | Datei: ${htmlPfad} | Ticks: ${TICKS}`);
  console.log("Seitenfehler: " + (fehler.length ? fehler.join(" | ") : "keine"));
  console.log("");
  console.log("Tick  Ereignis     Wer                  Uebung    Vers  Gueltig  Text");
  for (const z of zeilen) {
    console.log(
      String(z.tick).padStart(5) + "  " +
      z.ereignis.padEnd(11) + "  " +
      String(z.wer).padEnd(20) + "  " +
      String(z.uebung).padEnd(8) + "  " +
      String(z.versuch).padEnd(4) + "  " +
      String(z.gueltig == null ? "" : z.gueltig).padEnd(7) + "  " +
      z.ereignisText
    );
  }

  // ZUSAMMENFASSUNG: fuer jeden Versuch, bei dem sowohl ENTHUELLUNG als auch LAMPE gesehen
  // wurden, der Tick-Abstand (Enthuellung -> Lampe) UND ob der TICKER-Text (gueltig/
  // ungueltig) schon beim Enthuellungs-Tick oder erst beim Lampen-Tick auftauchte.
  console.log("");
  console.log("Zusammenfassung je Versuch (Tick-Abstand Enthuellung -> Lampe):");
  const byKey = new Map();
  for (const z of zeilen) {
    if (z.ereignis !== "ENTHUELLUNG" && z.ereignis !== "LAMPE") continue;
    const k = `${z.wer}|${z.uebung}|${z.versuch}`;
    if (!byKey.has(k)) byKey.set(k, {});
    byKey.get(k)[z.ereignis] = z.tick;
  }
  for (const [k, v] of byKey) {
    if (v.ENTHUELLUNG == null || v.LAMPE == null) continue;
    console.log(`  ${k}: Enthuellung@${v.ENTHUELLUNG}  Lampe@${v.LAMPE}  Abstand ${v.LAMPE - v.ENTHUELLUNG} Ticks`);
  }

  await browser.close();
} finally {
  server.close();
}
