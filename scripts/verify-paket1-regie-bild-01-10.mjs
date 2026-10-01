// SICHTPRUEFUNG fuer Paket 1 "Regie & Bild" (Fable-Ideen Buehne-Duell 30.09.,
// docs/design/fable-ideen-buehne-duell-30-09.md): S-F2 (Speed-Schach, "letztes Brett
// entscheidet"), F-F4 (Fechten, Perioden-Pause als Bild), T-F4 (Tennis, Ballwechsel-Laenge,
// Teil ohne Break-Banner, s. PR-Beschreibung). Kein Teil der Abnahme-Sonden (die sind
// miss-alle-disziplinen.mjs/messe-arena-einfluss.mjs) -- nur Beleg, dass die neue Anzeige im
// Produktionsmodus (data-theme="dark" + .im-spiel, dasselbe Muster wie
// verify-ticker-protokoll-01-10.mjs) ohne Seitenfehler sichtbar wirksam ist.
//
// Aufruf: node scripts/verify-paket1-regie-bild-01-10.mjs [ausgabeOrdner]
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { existsSync, mkdirSync, createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = path.join(WURZEL, "public");
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const MIME = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg", ".svg": "image/svg+xml", ".webp": "image/webp",
};
const AUSGABE = process.argv[2] || path.join(WURZEL, "tmp-ux-audit", "paket1-regie-bild-01-10");
mkdirSync(AUSGABE, { recursive: true });

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

const server = await starteServer();
const SEITE = `http://127.0.0.1:${server.address().port}/mockups/battle-mode.html`;
let browser;
const ergebnis = {};
try {
  browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
  for (const disc of ["speed-schach", "fechten", "tennis"]) {
    const seite = await browser.newPage({ viewport: { width: 1300, height: 900 } });
    const fehler = [];
    seite.on("pageerror", (e) => fehler.push(String(e)));
    seite.on("console", (m) => { if (m.type() === "error") fehler.push("console: " + m.text()); });
    await seite.goto(SEITE, { waitUntil: "networkidle" });
    await seite.addStyleTag({ content: "body{background:#0B1018}" });
    await seite.evaluate(() => {
      document.documentElement.setAttribute("data-theme", "dark");
      document.querySelector(".oly-battle-arena")?.setAttribute("data-theme", "dark");
      document.querySelector(".oly-battle-arena")?.classList.add("im-spiel");
    });
    await seite.waitForFunction(() => window.__arena && window.__arena.setDisc, null, { timeout: 30000 });
    await seite.evaluate((d) => window.__arena.setDisc(d), disc);
    await seite.click("#t2");
    // Volles Spiel durchfahren (60s Sim-Zeit reichen bei jeder Buehnen-Disziplin,
    // s. rundenDauer-Normierung auf 60/(rundenN*jeSeite*2) in BUEHNE_ART): 4200 Ticks a
    // 1/60 simulierte Sekunde ueber zeitFaktor() sind grosszuegig mehr als die 60 s.
    await seite.evaluate(() => window.__arena.sondenLauf(4200));
    await (await seite.$("#cv")).screenshot({ path: path.join(AUSGABE, `${disc}-buehne.png`) });
    const protokollText = await seite.evaluate(() => {
      const p = document.getElementById("protokoll");
      return p ? Array.from(p.querySelectorAll("div")).map((d) => d.textContent).join("\n") : "";
    });
    ergebnis[disc] = { fehler, protokollZeilen: protokollText.split("\n").filter(Boolean).length };
    if (disc === "speed-schach") {
      ergebnis[disc].sF2Belegt = protokollText.includes("vorzeitig entschieden");
    }
    if (disc === "fechten") {
      ergebnis[disc].fF4Belegt = /Doppeltreffer|muss in der letzten Periode angreifen|stehen vor Periode .* ausgeglichen/.test(protokollText);
    }
    if (disc === "tennis") {
      // T-F4 ist reine Canvas-Anzeige (Nahansicht-Kopfzeile) -- nur per Screenshot belegbar,
      // kein DOM-Text. Der Screenshot oben zeigt die Zeile "Platz N von M · Ballwechsel X/Y ·
      // Z Schläge" ueber dem Nahansicht-Duell.
      ergebnis[disc].hinweis = "Schlagzahl ist Canvas-Text, s. Screenshot " + disc + "-buehne.png";
    }
    await seite.close();
  }
} finally {
  server.close();
}

console.log(JSON.stringify(ergebnis, null, 2));
const seitenfehler = Object.entries(ergebnis).filter(([, v]) => v.fehler.length);
if (seitenfehler.length) {
  console.error("SEITENFEHLER gefunden:", seitenfehler);
  process.exit(1);
}
console.log("Seitenfehler: keine");
