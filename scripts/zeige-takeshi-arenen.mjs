// SICHTPROBE TAKESHI'S CASTLE IM VIER-TEAM-POD (Arenen-Remake 17.11.,
// docs/design/takeshi-arenen-remake-17-11.md). Kein Teil der Abnahme -- nur zum Ansehen/Belegen.
//
// Aufruf: node scripts/zeige-takeshi-arenen.mjs <ausgabeOrdner> <praefix> [kulisseId ...]
//   <ausgabeOrdner>  Zielordner fuer die JPEGs (q=70).
//   <praefix>        Dateinamen-Praefix, z.B. "vorher" oder "nachher".
//   [kulisseId ...]  Arena-Varianten, die per window.__arena.kulisseQa(id) gepinnt werden
//                    (z.B. "nebelmoor" "aschenfeste"). Ohne Angabe: ein Lauf ohne Pin (die
//                    Hash-Wahl bzw. -- vor dem Remake -- die alte Midoriyama-Karte).
// Je Variante drei Bilder: Ueberblick am Start (Zoom 1), Folge-Kamera im Rennen, spaetes Rennen.
// public/ wird selbst serviert (wie scripts/screenshot-disziplin.mjs) -- kein Dev-Server noetig.
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { existsSync, mkdirSync, createReadStream, statSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { sendungsrahmenAus } from "./lib/arena-anpfiff.mjs";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = path.join(WURZEL, "public");
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".webp": "image/webp", ".mp3": "audio/mpeg",
  ".wav": "audio/wav", ".ogg": "audio/ogg", ".woff2": "font/woff2" };

function starteServer() {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url, "http://localhost");
      let p = path.join(PUBLIC, decodeURIComponent(url.pathname));
      if (!p.startsWith(PUBLIC)) { res.writeHead(403); res.end(); return; }
      try {
        if (statSync(p).isDirectory()) p = path.join(p, "index.html");
        res.writeHead(200, { "Content-Type": MIME[path.extname(p)] || "application/octet-stream" });
        createReadStream(p).pipe(res);
      } catch { res.writeHead(404); res.end("not found"); }
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

const [ordner, praefix, ...ids] = process.argv.slice(2);
if (!ordner || !praefix) {
  console.error("Nutzung: node scripts/zeige-takeshi-arenen.mjs <ausgabeOrdner> <praefix> [kulisseId ...]");
  process.exit(1);
}
mkdirSync(ordner, { recursive: true });
const familie = JSON.parse(readFileSync(path.join(WURZEL, "data/generated/kaderfamilie-live-save.json"), "utf8"));
const teams = [familie.varianten[0].heim, familie.varianten[0].gast, familie.varianten[1].heim, familie.varianten[1].gast];

const server = await starteServer();
let browser;
try {
  browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
  const seite = await browser.newPage({ viewport: { width: 1300, height: 700 } });
  const fehler = [];
  seite.on("pageerror", (e) => fehler.push(String(e)));
  await seite.goto(`http://127.0.0.1:${server.address().port}/mockups/battle-mode.html`, { waitUntil: "networkidle" });
  await seite.waitForFunction(() => window.__arena && window.__arena.setDisc, null, { timeout: 30000 });
  await sendungsrahmenAus(seite);
  for (const id of ids.length ? ids : [null]) {
    const aktiv = await seite.evaluate(({ teams, id }) => {
      const a = window.__arena;
      a.kulisseQa(id);
      const pod = { teams: teams.map((kader, i) => ({ name: "Team " + "ABCD"[i], kader })), k: 3, saat: 4242, aufstellung: null };
      a.bahnPodAnzeigen("takeshis-castle", pod);
      a.setDisc("takeshis-castle");
      return a.kulisseQa(id);
    }, { teams, id });
    // Bilder (Kulisse, Requisiten) laden lassen, dann drei Stellen des Rennens.
    await seite.waitForTimeout(1500);
    const bild = async (name, ticks) => {
      await seite.evaluate((n) => window.__arena.sondenLauf(n), ticks);
      await seite.waitForTimeout(150);
      const datei = path.join(ordner, `${praefix}${id ? "-" + id : ""}-${name}.jpg`);
      // Leinwand direkt auslesen (kein Element-Screenshot: der wartet auf eine ruhige Seite).
      const b64 = await seite.evaluate(() => document.getElementById("cv").toDataURL("image/jpeg", 0.7).split(",")[1]);
      writeFileSync(datei, Buffer.from(b64, "base64"));
      console.log("Bild: " + datei);
    };
    await bild("1-ueberblick", 0);
    await bild("2-rennen", 420);
    await bild("3-spaet", 1500);
    console.log("Kulisse: " + JSON.stringify(aktiv));
  }
  console.log("Seitenfehler: " + (fehler.length ? fehler.join(" | ") : "keine"));
} finally {
  if (browser) await browser.close();
  server.close();
}
