// SICHTPRUEFUNG fuer Paket 3 "Fechten-Format" (Fable-Ideen Buehne-Duell 30.09.,
// docs/design/fable-ideen-buehne-duell-30-09.md Abschnitt 3): F-F1 (Die Fechtstaffel) +
// F-F2 (Die Mensur, Variante A). Kein Teil der Abnahme-Sonden (die sind
// miss-alle-disziplinen.mjs/messe-arena-einfluss.mjs/miss-arena-buehne-spiegel.mjs/
// miss-fechten-mensur-haeufigkeit.mjs) -- nur Beleg, dass das neue Format im
// Produktionsmodus (data-theme="dark" + .im-spiel, dasselbe Muster wie
// verify-buehne-startreihenfolge-paket1-01-10.mjs) ohne Seitenfehler durch ein ganzes
// Fechten-Match laeuft: Bahn 1 enthuellt komplett, bevor Bahn 2 beginnt (Staffel), und
// mindestens eine der sechs Bahnen zeigt im Verlauf einen Mensur-Treffer (Trefferstand
// springt um mehr als die blossen erfolgWort-Treffer dieser Bahn).
//
// Aufruf: node scripts/verify-fechten-format-paket3-01-10.mjs [ausgabeOrdner] [saat]
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { existsSync, mkdirSync, createReadStream, statSync, writeFileSync } from "node:fs";
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
const AUSGABE = process.argv[2] || path.join(WURZEL, "tmp-ux-audit", "paket3-fechten-format-01-10");
const SAAT = Number(process.argv[3] || 20261001);
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
const ergebnis = { fehler: [], etappen: [] };
try {
  browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
  const seite = await browser.newPage({ viewport: { width: 1300, height: 900 } });
  const fehler = [];
  seite.on("pageerror", (e) => fehler.push(String(e)));
  seite.on("console", (m) => {
    if (m.type() === "error" && !/Failed to load resource.*404/.test(m.text())) {
      fehler.push("console: " + m.text());
    }
  });
  await seite.goto(SEITE, { waitUntil: "networkidle" });
  await seite.waitForFunction(() => window.__arena && window.__arena.setDisc, null, { timeout: 30000 });

  await seite.addStyleTag({ content: "body{background:#0B1018}" });
  await seite.evaluate(() => {
    document.documentElement.setAttribute("data-theme", "dark");
    document.querySelector(".oly-battle-arena")?.setAttribute("data-theme", "dark");
    document.querySelector(".oly-battle-arena")?.classList.add("im-spiel");
  });
  await seite.evaluate(() => window.__arena.setDisc("fechten"));
  await seite.click("#t2");
  await seite.click("#play");

  // Etappen durchs ganze Match (rundenDauer 60/(9*6*2)s je Zug, 108 Zuege ~ 60s gesamt,
  // M.lauf()-Budget 120s -- grosszuegig ueber das erwartete Ende hinaus sondiert).
  const etappenTicks = [60, 300, 600, 1200, 2400, 4800, 7200];
  for (const ticks of etappenTicks) {
    await seite.evaluate((t) => window.__arena.sondenLauf(t), ticks);
    await (await seite.$("#cv")).screenshot({ path: path.join(AUSGABE, `tick-${ticks}.png`) });
    ergebnis.etappen.push({ ticks });
  }
  ergebnis.fehler = fehler;
  await seite.close();
} finally {
  server.close();
}

writeFileSync(path.join(AUSGABE, "ergebnis.json"), JSON.stringify(ergebnis, null, 2));
console.log(JSON.stringify(ergebnis, null, 2));
if (ergebnis.fehler.length) {
  console.error("SEITENFEHLER gefunden:", ergebnis.fehler);
  process.exit(1);
}
console.log("Seitenfehler: keine -- Fechten-Match lief ueber alle Etappen ohne Fehler durch (Screenshots in " + AUSGABE + ").");
