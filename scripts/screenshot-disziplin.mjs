// Generalisierung von scripts/screenshot-gewichtheben.mjs (PR 0, Opus-Plan Abschnitt 3.4):
// derselbe Rauchtest, aber fuer eine per Kommandozeile gewaehlte Disziplin statt fest auf
// Gewichtheben verdrahtet. Kein Teil der Abnahme-Sonden — nur zum Ansehen/Belegen (Vorher/
// Nachher-Screenshots je Ziel-PR).
//
// Aufruf: node scripts/screenshot-disziplin.mjs <disziplin> [wartenMs] [ausgabe]
//   <disziplin>  window.__arena.setDisc()-Name, z.B. "gewichtheben", "eiskunstlauf",
//                "breaking", "takeshis-castle" (genau wie in BUEHNE_ART/BAHN_ART/#dd).
//   [wartenMs]   wie lange nach #play gewartet wird, bevor der Screenshot faellt (Default 3000).
//   [ausgabe]    Zieldatei fuer das PNG (Default tmp-ux-audit/<disziplin>-buehne.png).
//
// Die drei bestehenden screenshot-*.mjs-Dateien (gewichtheben, speed-schach,
// speed-schach-sieger, schild-krolach, broadcast-hud) bleiben unangetastet — sie sind in
// PR-Beschreibungen referenziert.
//
// HTTP STATT file:// (Opus-Review 27.09., zwei unabhaengige Fundstellen am selben Tag):
// battle-mode.html laedt Sprites/Portraits/Team-Logos ueber ABSOLUTE Pfade
// ("/sprites/...", "/portraits/...", "/team-logos/..."). Unter file:// loest der Browser
// so einen Pfad gegen die Dateisystem-Wurzel auf, nicht gegen public/ — jede dieser
// Ressourcen schlug lautlos fehl (kein Netzwerkfehler im ueblichen Sinn, nur ein
// nicht-existierender lokaler Pfad), und Schachfiguren/Spielerportraits/Wappen fielen auf
// ihre generischen Platzhalter zurueck (Schachfiguren als Scheiben, Takeshi's-Castle-Feld
// ohne Baeume/Palisaden). Screenshots aus dieser Datei UNTERSCHAETZTEN dadurch systematisch
// die echte optische Qualitaet. Derselbe Server-Kniff wie in screenshot-speed-schach.mjs &
// Co.: public/ selbst servieren, auf einem freien Port, Server per try/finally sicher
// wieder schliessen — keine Abhaengigkeit von einem separat laufenden Dev-Server.
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { existsSync, mkdirSync, createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = path.join(WURZEL, "public");
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
};

function starteServer() {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url, "http://localhost");
      let p = path.join(PUBLIC, decodeURIComponent(url.pathname));
      if (!p.startsWith(PUBLIC)) {
        res.writeHead(403);
        res.end();
        return;
      }
      try {
        const st = statSync(p);
        if (st.isDirectory()) p = path.join(p, "index.html");
        const ext = path.extname(p);
        res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
        createReadStream(p).pipe(res);
      } catch {
        res.writeHead(404);
        res.end("not found: " + p);
      }
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

const disziplin = process.argv[2];
if (!disziplin) {
  console.error("Nutzung: node scripts/screenshot-disziplin.mjs <disziplin> [wartenMs] [ausgabe]");
  process.exit(1);
}
const wartenMs = Number(process.argv[3] || 3000);
const out = process.argv[4] || path.join(WURZEL, "tmp-ux-audit", disziplin + "-buehne.png");
mkdirSync(path.dirname(out), { recursive: true });

const server = await starteServer();
const port = server.address().port;
const SEITE = `http://127.0.0.1:${port}/mockups/battle-mode.html`;
let browser;
try {
  browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
  const seite = await browser.newPage({ viewport: { width: 1300, height: 700 } });
  const fehler = [];
  seite.on("pageerror", (e) => fehler.push(String(e)));
  await seite.goto(SEITE, { waitUntil: "networkidle" });
  await seite.waitForFunction(() => window.__arena && window.__arena.setDisc, null, { timeout: 30000 });
  const gesetzt = await seite.evaluate((d) => {
    try {
      window.__arena.setDisc(d);
      return true;
    } catch (e) {
      return String(e);
    }
  }, disziplin);
  if (gesetzt !== true) {
    console.error("setDisc(" + JSON.stringify(disziplin) + ") schlug fehl: " + gesetzt);
    process.exit(1);
  }
  await seite.click("#t2");
  await seite.click("#play");
  await seite.waitForTimeout(wartenMs);
  const cv = await seite.$("#cv");
  await cv.screenshot({ path: out });
  console.log("Screenshot: " + out);
  console.log("Seitenfehler: " + (fehler.length ? fehler.join(" | ") : "keine"));
} finally {
  if (browser) await browser.close();
  server.close();
}
