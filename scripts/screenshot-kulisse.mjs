// KULISSEN-SICHTPROBE (Kulissen-Integration 07.11.): fotografiert die Leinwand der echten Battle
// Arena in voller Aufloesung (1240x470 ueber toDataURL, nicht den herunterskalierten CSS-Ausschnitt)
// fuer eine Disziplin und eine gepinnte Kulissen-Variante (window.__arena.kulisseQa).
//
// Aufruf: node scripts/screenshot-kulisse.mjs <disziplin> [variante|-] [wartenMs] [ausgabe] [--pod] [--ohne-kulisse] [--format=hatz|hyrox]
//   <disziplin>     window.__arena.setDisc()-Name.
//   [variante]      Kulissen-Id aus battle-mode.kulissen.js ("-" = Hash-Wahl des Motors).
//   [wartenMs]      Wartezeit nach dem Anpfiff (Default 2500).
//   [ausgabe]       PNG-Ziel (Default tmp-ux-audit/kulisse-<disziplin>-<variante>.png).
//   --pod           nur Battlefield: Vier-Team-Pod aus data/generated/kaderfamilie-live-save.json
//                   anzeigen (derselbe Weg wie echterKader.battlefieldPod vom Host).
//   --ohne-kulisse  window.__ARENA_KULISSEN vor dem Motor leeren -> alter Boden (Vorher-Bild).
//   --format=hatz   nur Spurt (Format-Fundament, 08.11., s. BAHN_FLAGS in battle-mode.engine.js):
//                   fordert "Die Hatz" ueber window.__arena.bahnFlags() an, statt des heutigen
//                   Huerdenlaufs. Ohne den Schalter unveraendert "klassisch".
//   --format=hyrox  nur Spurt, dasselbe Prinzip: fordert "HYROX-Stationen" an (s.
//                   docs/design/spurt-format-hyrox-stationen-08-11.md). Dieses Skript brauchte
//                   dafuer KEINE Codeaenderung -- `format` geht ungeprueft an bahnFlags() durch,
//                   das seit 08.11. auch "hyrox" als gueltigen Wert kennt.
//   --hyrox-ansicht=bahn  nur Spurt im Format "hyrox" (Hallenrunde-PR, Design-Dokument 7.1):
//                   schaltet auf die alte gerade Bahn zurueck (Vorher-Bild) statt der seit
//                   Stufe 2 standardmaessigen Hallenrunde. Ohne den Schalter "halle".
//
// Reine Anzeige-Sonde: liest nichts in die Simulation zurueck. HTTP statt file:// (absolute
// Sprite-Pfade, s. screenshot-disziplin.mjs).
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { existsSync, mkdirSync, createReadStream, statSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { sendungsrahmenAus, warteAufAnpfiff } from "./lib/arena-anpfiff.mjs";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = path.join(WURZEL, "public");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".webp": "image/webp" };

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
      } catch { res.writeHead(404); res.end(); }
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

const POD = process.argv.includes("--pod");
const OHNE = process.argv.includes("--ohne-kulisse");
const FORMAT = process.argv.find((a) => a.startsWith("--format="))?.split("=")[1] || null;
const HYROX_ANSICHT = process.argv.find((a) => a.startsWith("--hyrox-ansicht="))?.split("=")[1] || null;
const arg = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const disziplin = arg[0];
if (!disziplin) { console.error("Nutzung: node scripts/screenshot-kulisse.mjs <disziplin> [variante|-] [wartenMs] [ausgabe] [--pod] [--ohne-kulisse]"); process.exit(1); }
const variante = arg[1] && arg[1] !== "-" ? arg[1] : null;
const wartenMs = Number(arg[2] || 2500);
const out = arg[3] || path.join(WURZEL, "tmp-ux-audit", `kulisse-${disziplin}-${variante || "hash"}${POD ? "-pod" : ""}${FORMAT ? "-" + FORMAT : ""}.png`);
mkdirSync(path.dirname(out), { recursive: true });

let pod = null;
if (POD) {
  const v = JSON.parse(readFileSync(path.join(WURZEL, "data/generated/kaderfamilie-live-save.json"), "utf8")).varianten;
  pod = { teams: [
    { name: v[0].heimName, kader: v[0].heim }, { name: v[0].gastName, kader: v[0].gast },
    { name: v[1].heimName, kader: v[1].heim }, { name: v[1].gastName, kader: v[1].gast },
  ], k: 4, saat: 42 };
}

const server = await starteServer();
let browser;
try {
  const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
  browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
  const seite = await browser.newPage({ viewport: { width: 1300, height: 700 } });
  const fehler = [];
  seite.on("pageerror", (e) => fehler.push(String(e)));
  if (OHNE) {
    await seite.route("**/battle-mode.kulissen.js", (r) => r.fulfill({ contentType: "text/javascript", body: "window.__ARENA_KULISSEN={};" }));
  }
  await seite.goto(`http://127.0.0.1:${server.address().port}/mockups/battle-mode.html`, { waitUntil: "networkidle" });
  await seite.waitForFunction(() => window.__arena && window.__arena.setDisc, null, { timeout: 30000 });
  await seite.evaluate(({ d, v, pod, format, hyroxAnsicht }) => {
    const A = window.__arena;
    if (format && A.bahnFlags) A.bahnFlags({ spurtFormat: format });
    if (hyroxAnsicht && A.bahnFlags) A.bahnFlags({ hyroxAnsicht });
    A.setDisc(d);
    if (pod && A.battlefieldPodAnzeigen) A.battlefieldPodAnzeigen(pod);
    if (A.kulisseQa) A.kulisseQa(v);
  }, { d: disziplin, v: variante, pod, format: FORMAT, hyroxAnsicht: HYROX_ANSICHT });
  await seite.click("#t2");
  await sendungsrahmenAus(seite, { countdown: true, finale: false, nachlauf: false, figuren: false });
  await seite.click("#play");
  await warteAufAnpfiff(seite);
  await seite.waitForTimeout(wartenMs);
  const daten = await seite.evaluate(() => {
    const k = window.__arena.kulisse ? window.__arena.kulisse() : null;
    return { url: document.getElementById("cv").toDataURL("image/png"), kulisse: k };
  });
  writeFileSync(out, Buffer.from(daten.url.split(",")[1], "base64"));
  console.log("Screenshot: " + out);
  console.log("Kulisse: " + JSON.stringify(daten.kulisse));
  console.log("Seitenfehler: " + (fehler.length ? fehler.join(" | ") : "keine"));
} finally {
  if (browser) await browser.close();
  server.close();
}
