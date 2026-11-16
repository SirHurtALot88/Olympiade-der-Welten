// PRUEFT die Formatwahl fuer Spurt im echten Spiel (16.11., s. spurtFormatWaehlen() in
// public/mockups/battle-mode.engine.js): mit eingehaengtem echten Kader (heim/gast) waehlt
// die Saat deterministisch klassisch/hatz/hyrox (gleiche Saat -> gleiches Format, alle drei
// Formate kommen vor); OHNE Kader bleibt es "klassisch" (Messwerkzeuge bit-identisch), und ein
// ausdruecklich gesetztes Format (window.__arena.bahnFlags) gewinnt immer.
// Aufruf: node scripts/pruefe-spurt-formatwahl.mjs   (Exit 1 bei Verstoss)
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { existsSync, createReadStream, statSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = path.join(WURZEL, "public");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".webp": "image/webp" };
const server = createServer((req, res) => {
  const p = path.join(PUBLIC, decodeURIComponent(req.url.split("?")[0]));
  if (!p.startsWith(PUBLIC) || !existsSync(p) || statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": MIME[path.extname(p)] || "application/octet-stream" });
  createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const v = JSON.parse(readFileSync(path.join(WURZEL, "data/generated/kaderfamilie-live-save.json"), "utf8")).varianten[0];
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
const SAATEN = Array.from({ length: 300 }, (_, i) => i + 1);

async function lauf({ mitKader, explizit }) {
  const seite = await browser.newPage();
  const fehler = [];
  seite.on("pageerror", (e) => fehler.push(String(e)));
  if (mitKader) await seite.addInitScript((k) => { window.__olyArenaKader = { heim: k.heim, gast: k.gast, meta: {} }; }, { heim: v.heim, gast: v.gast });
  await seite.goto(`http://127.0.0.1:${server.address().port}/mockups/battle-mode.html`, { waitUntil: "networkidle" });
  await seite.waitForFunction(() => window.__arena && window.__arena.spiele && window.__arena.spurtFormatProbe, null, { timeout: 30000 });
  const r = await seite.evaluate(({ saaten, explizit }) => {
    const A = window.__arena;
    if (explizit) A.bahnFlags({ spurtFormat: explizit });
    return saaten.map((s) => A.spurtFormatProbe(s));
  }, { saaten: SAATEN, explizit });
  await seite.close();
  return { r, fehler };
}
const a = await lauf({ mitKader: true });
const b = await lauf({ mitKader: true });
const c = await lauf({ mitKader: false });
const d = await lauf({ mitKader: true, explizit: "klassisch" });
await browser.close(); server.close();

const zaehl = (x) => x.reduce((m, f) => ((m[f] = (m[f] || 0) + 1), m), {});
console.log("mit Kader   :", zaehl(a.r));
console.log("ohne Kader  :", zaehl(c.r));
console.log("explizit klassisch (mit Kader):", zaehl(d.r));
let schlecht = 0;
const pruefe = (ok, msg) => { if (!ok) { schlecht++; console.error("VERSTOSS:", msg); } };
pruefe(JSON.stringify(a.r) === JSON.stringify(b.r), "gleiche Saat ergab nicht gleiches Format");
for (const f of ["klassisch", "hatz", "hyrox"]) pruefe(a.r.includes(f), "mit Kader kam " + f + " nie vor");
pruefe(c.r.every((f) => f === "klassisch"), "ohne Kader nicht durchgehend klassisch (Messwerkzeuge muessten bit-identisch bleiben)");
pruefe(d.r.every((f) => f === "klassisch"), "explizit klassisch wurde von der Wahl uebersteuert");
for (const x of [a, b, c, d]) pruefe(x.fehler.length === 0, "Seitenfehler: " + x.fehler.join("; "));
process.exit(schlecht ? 1 : 0);
