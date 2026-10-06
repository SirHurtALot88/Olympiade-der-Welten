// STANDBILD-SONDE GEWICHTHEBEN (Broadcast-Sendungsrhythmus Paket B, 06.10.): dasselbe
// Verfahren wie das Opus-Audit, das die Ausgangszahlen "66% stehende Bilder, laengster
// Stillstand 3,5s" gemessen hat (CLAUDE.md/Planvorgabe: "Playwright, Pixel-Diff zwischen
// Frames, Schwelle 1%, alle 0,5s, Tempo 1x") -- dieses Skript selbst war nicht im Repo,
// nur sein Ergebnis in Prosa, deshalb hier neu gebaut, nach demselben Muster. Es spielt EIN
// echtes Gewichtheben-Spiel in ECHTZEIT (RAF-Loop über #play, Tempo 1x -- NICHT
// window.__arena.sondenLauf(), das Ticks ohne Zeichnen durchnudelt) und fotografiert
// .arenaraum (Leinwand UND das HTML-Overlay #bbug/#bbugcallout darueber, s. battle-mode.html
// -- GENAU das, was ein Zuschauer sieht) alle 0,5 Sekunden Wandzeit.
//
// "STEHEND" heisst: der Anteil sichtbar unterschiedlicher Pixel zwischen zwei aufeinander-
// folgenden Aufnahmen liegt unter der 1%-Schwelle. Downsample auf 160x61 (dieselbe
// Seitenverhaeltnis-Groessenordnung wie die 155x59 der Audit-Beschreibung) vor dem Vergleich,
// damit Anti-Aliasing-Rauschen einzelner Pixel nicht als Bewegung zaehlt; pro Pixel zaehlt
// ein Unterschied erst ab einer kleinen Helligkeits-Toleranz (10 von 255) als "geaendert".
//
// AUSSCHLIESSLICH LESEND/BEOBACHTEND: kein window.__arena-Zustand wird geschrieben, kein
// rr(), keine Wertung beruehrt -- reine Sichtpruefung, wie screenshot-broadcast-hud.mjs.
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { existsSync, mkdirSync, createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import sharp from "sharp";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = path.join(WURZEL, "public");
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png" };

const BREITE = 160, HOEHE = 61; // ~155x59-Groessenordnung der Audit-Beschreibung, selbes Seitenverhaeltnis wie 1240x470
const DIFF_TOLERANZ = 10; // pro Kanal, 0..255 -- Anti-Aliasing-Rauschen faellt heraus
const STEHEND_SCHWELLE = 0.01; // 1% der Pixel
const SAMPLE_MS = 500;
// Deckel: 600s Wandzeit, deutlich ueber den erwarteten ~450s eines Spiels bei Tempo 1x.
// `node ... -- --max-samples N` schaltet fuer einen schnellen Rauchtest kleiner.
const maxArg = process.argv.find((a) => a.startsWith("--max-samples="));
const MAX_SAMPLES = maxArg ? Number(maxArg.split("=")[1]) : 1200;

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

async function downsampleRoh(pngBuffer) {
  const { data } = await sharp(pngBuffer)
    .resize(BREITE, HOEHE, { fit: "fill" })
    .removeAlpha()
    .toColorspace("srgb")
    .raw()
    .toBuffer({ resolveWithObject: true });
  return data; // Buffer, 3 Kanaele je Pixel (RGB)
}

function pixelAnteilGeaendert(a, b) {
  let geaendert = 0;
  const pixelN = BREITE * HOEHE;
  for (let i = 0; i < pixelN; i++) {
    const o = i * 3;
    const dr = Math.abs(a[o] - b[o]), dg = Math.abs(a[o + 1] - b[o + 1]), db = Math.abs(a[o + 2] - b[o + 2]);
    if (dr > DIFF_TOLERANZ || dg > DIFF_TOLERANZ || db > DIFF_TOLERANZ) geaendert++;
  }
  return geaendert / pixelN;
}

const ausgabeOrdner = path.join(WURZEL, "tmp-ux-audit", "gewichtheben-standbild-06-10");
mkdirSync(ausgabeOrdner, { recursive: true });
const server = await starteServer();
const port = server.address().port;
const SEITE = `http://127.0.0.1:${port}/mockups/battle-mode.html`;

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
  const tempoTxt = await seite.$eval("#spd", (e) => e.textContent.trim());
  console.log(`Tempo laut Button: "${tempoTxt}" (erwartet "Tempo 1×", kein Klick noetig)`);
  await seite.click("#play");

  const arenaraum = await seite.$(".arenaraum");
  let vorher = null;
  let stehendeIntervalle = 0, gesamtIntervalle = 0;
  let laufendeStillstandslaenge = 0, laengsterStillstandSek = 0;
  const geaendertVerlauf = [];
  let fertig = false;
  let samples = 0;

  while (samples < MAX_SAMPLES && !fertig) {
    await seite.waitForTimeout(SAMPLE_MS);
    samples++;
    const png = await arenaraum.screenshot();
    const roh = await downsampleRoh(png);
    if (vorher) {
      const anteil = pixelAnteilGeaendert(vorher, roh);
      geaendertVerlauf.push(anteil);
      gesamtIntervalle++;
      if (anteil < STEHEND_SCHWELLE) {
        stehendeIntervalle++;
        laufendeStillstandslaenge += SAMPLE_MS / 1000;
        if (laufendeStillstandslaenge > laengsterStillstandSek) laengsterStillstandSek = laufendeStillstandslaenge;
      } else {
        laufendeStillstandslaenge = 0;
      }
    }
    vorher = roh;
    const phase = await seite.$eval("#phase", (e) => e.textContent).catch(() => "");
    if (phase === "beendet") fertig = true;
  }

  const anteilStehend = gesamtIntervalle ? stehendeIntervalle / gesamtIntervalle : 0;
  console.log(`\nSpiel ${fertig ? "beendet" : "NICHT beendet (Deckel erreicht)"} nach ${samples} Aufnahmen (${(samples * SAMPLE_MS / 1000).toFixed(1)}s Wandzeit).`);
  console.log(`Vergleichsintervalle: ${gesamtIntervalle}`);
  console.log(`Anteil stehender Bilder (< ${(STEHEND_SCHWELLE * 100).toFixed(0)}% Pixel geaendert): ${(anteilStehend * 100).toFixed(1)}%`);
  console.log(`Laengster zusammenhaengender Stillstand: ${laengsterStillstandSek.toFixed(1)}s`);
  console.log(`Seitenfehler: ${fehler.length ? fehler.join(" | ") : "keine"}`);

  // Rohdaten fuer einen spaeteren Vorher/Nachher-Vergleich von Hand.
  const { writeFileSync } = await import("node:fs");
  writeFileSync(path.join(ausgabeOrdner, "geaendert-anteile.json"), JSON.stringify({
    anteilStehend, laengsterStillstandSek, gesamtIntervalle, geaendertVerlauf,
  }, null, 0));
  console.log(`Rohdaten: ${path.join(ausgabeOrdner, "geaendert-anteile.json")}`);
} finally {
  if (browser) await browser.close();
  server.close();
}
