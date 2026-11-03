// IDENTITAETS-PRUEFUNG WETTESSEN (Uebersichts-Paket 03.11.): spielt das Wettessen fuer mehrere
// Saaten headless durch (window.__arena.spieleBuehneAuftritt) und schreibt Seiten + Boxscore als
// JSON -- einmal gegen den Arbeitsbaum, einmal gegen einen zweiten public/-Ordner (z.B. ein
// `git archive origin/main public/mockups`-Auszug). Sind beide Dateien byte-identisch, hat das
// Praesentationspaket die Wertung nicht beruehrt (Klasse A).
//
// Aufruf: node scripts/pruefe-wettessen-identisch.mjs <public-ordner> <ausgabe.json> [saaten=1,2,3,4,5,6]
import { chromium } from "playwright";
import { existsSync, createReadStream, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";

const [wurzelPublic, ausgabe, saatenArg] = process.argv.slice(2);
if (!wurzelPublic || !ausgabe) { console.error("Nutzung: <public-ordner> <ausgabe.json> [saaten]"); process.exit(1); }
const saaten = (saatenArg || "1,2,3,4,5,6").split(",").map(Number);
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };
const server = await new Promise((resolve) => {
  const s = createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    const datei = path.join(wurzelPublic, decodeURIComponent(url.pathname));
    if (!datei.startsWith(wurzelPublic) || !existsSync(datei) || statSync(datei).isDirectory()) { res.statusCode = 404; res.end(); return; }
    res.setHeader("Content-Type", MIME[path.extname(datei)] || "application/octet-stream");
    createReadStream(datei).pipe(res);
  });
  s.listen(0, "127.0.0.1", () => resolve(s));
});
const browser = await chromium.launch();
try {
  const seite = await browser.newPage();
  const fehler = [];
  seite.on("pageerror", (e) => fehler.push(String(e)));
  await seite.goto(`http://127.0.0.1:${server.address().port}/mockups/battle-mode.html`, { waitUntil: "load" });
  await seite.waitForFunction(() => window.__arena && window.__arena.spieleBuehneAuftritt, null, { timeout: 60000 });
  const erg = await seite.evaluate((ss) => ss.map((s) => ({ saat: s, ergebnis: window.__arena.spieleBuehneAuftritt("wettessen", s) })), saaten);
  writeFileSync(ausgabe, JSON.stringify(erg, null, 1));
  console.log("geschrieben: " + ausgabe + " (" + saaten.length + " Saaten), Seitenfehler: " + (fehler.length ? fehler.join(" | ") : "keine"));
} finally {
  await browser.close();
  server.close();
}
