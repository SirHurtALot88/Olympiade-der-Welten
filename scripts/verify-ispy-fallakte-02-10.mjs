// SICHTPRUEFUNG fuer I-5 "Die Fallakte" (Task #42, docs/design/fable-ideen-arena-ispy-30-09.md
// Abschnitt "I-5 · Die Fallakte — A, klein"). Kein Teil der Abnahme-Sonden -- nur zum
// Ansehen/Belegen, dass die neue, rein additive Anzeige tatsaechlich erscheint und keinen
// Seitenfehler wirft.
//
// Faehrt I-Spy per window.__arena.sondenLauf() (deterministisch, pixelstabil) bis zum Ende der
// Enthuellung und prueft:
//   1. keine pageerror/console-Fehler,
//   2. mindestens eine Ticker-/Protokollzeile traegt den Fallakte-Zaehler ("X von Y Hinweisen"),
//   3. beide Abschlusszeilen ("Team Heim/Gast löst den Fall: ...") stehen im Protokoll,
//   4. Screenshot des Panels am Spielende als Beleg.
//
// Aufruf: node scripts/verify-ispy-fallakte-02-10.mjs [ausgabeOrdner]
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
  ".mp3": "audio/mpeg", ".wav": "audio/wav", ".ogg": "audio/ogg",
};
const AUSGABE = process.argv[2] || path.join(WURZEL, "tmp-ux-audit", "ispy-fallakte-02-10");
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
let browser, exitCode = 0;
try {
  browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
  const seite = await browser.newPage({ viewport: { width: 1300, height: 900 } });
  const fehler = [];
  seite.on("pageerror", (e) => fehler.push(String(e)));
  seite.on("console", (m) => { if (m.type() === "error") fehler.push(m.text()); });
  await seite.goto(SEITE, { waitUntil: "networkidle" });
  await seite.addStyleTag({ content: "body{background:#0B1018}" });
  await seite.evaluate(() => {
    document.documentElement.setAttribute("data-theme", "dark");
    document.querySelector(".oly-battle-arena")?.setAttribute("data-theme", "dark");
    document.querySelector(".oly-battle-arena")?.classList.add("im-spiel");
  });
  await seite.waitForFunction(() => window.__arena && window.__arena.setDisc, null, { timeout: 30000 });
  await seite.evaluate(() => window.__arena.setDisc("i-spy"));
  await seite.click("#t2");
  // 8 Ticks * 12 Teilnehmer * rundenDauer(60/(8*6*2)=0,625s) ~= 60s Enthuellung -- 90s Puffer.
  await seite.evaluate(() => window.__arena.sondenLauf(90 * 60));
  const texte = await seite.evaluate(() => ({
    ticker: Array.from(document.querySelectorAll("#feed > div")).map((d) => d.textContent),
    protokoll: Array.from(document.querySelectorAll("#protokoll > div")).map((d) => d.textContent),
  }));
  await seite.click("#ftProtokoll");
  const box = await seite.$("#p2 .untenraum");
  if (box) await box.screenshot({ path: path.join(AUSGABE, "ispy-fallakte-protokoll.png") });
  const frame = await seite.$("#p2 .frame");
  if (frame) await frame.screenshot({ path: path.join(AUSGABE, "ispy-fallakte-panel.png") });

  const alleZeilen = texte.protokoll.length ? texte.protokoll : texte.ticker;
  const zaehlerZeilen = alleZeilen.filter((z) => /Fallakte \d+ von \d+ Hinweisen/.test(z));
  const heimSatz = alleZeilen.find((z) => z.includes("Team Heim löst den Fall:"));
  const gastSatz = alleZeilen.find((z) => z.includes("Team Gast löst den Fall:"));

  console.log(`Zeilen gesamt: ${alleZeilen.length} (Ticker ${texte.ticker.length}, Protokoll ${texte.protokoll.length})`);
  console.log(`Fallakte-Zaehler-Zeilen: ${zaehlerZeilen.length}`);
  if (zaehlerZeilen.length) console.log(`  Beispiel: "${zaehlerZeilen[0].trim()}"`);
  console.log(`Heim-Abschlusszeile: ${heimSatz ? `"${heimSatz.trim()}"` : "FEHLT"}`);
  console.log(`Gast-Abschlusszeile: ${gastSatz ? `"${gastSatz.trim()}"` : "FEHLT"}`);
  console.log(`Seitenfehler: ${fehler.length ? fehler.join(" | ") : "keine"}`);

  if (!zaehlerZeilen.length || !heimSatz || !gastSatz || fehler.length) exitCode = 1;
  await seite.close();
} finally {
  if (browser) await browser.close();
  server.close();
}
process.exit(exitCode);
