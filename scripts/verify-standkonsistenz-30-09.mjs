// SICHTPRUEFUNG fuer PR "broadcast-standkonsistenz-30-09" (F1-Broadcast-Audit Runde 2,
// 30.09., Prio-1-Punkte 1/3/6). Kein Teil der Abnahme-Sonden -- nur zum Ansehen/Belegen.
// Nimmt je Disziplin drei Screenshots des GESAMTEN Arena-Panels (.frame, nicht nur #cv --
// die relevanten Aenderungen liegen in #score/#kmitte/#bbugMitte AUSSERHALB des Canvas)
// und protokolliert an denselben drei Zeitpunkten den Text von #score, #kmitte und
// #bbugMitte, damit sich die Konsistenz auch ohne Bildvergleich nachlesen laesst.
//
// Aufruf: node scripts/verify-standkonsistenz-30-09.mjs <disziplin> [ausgabeOrdner]
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { existsSync, mkdirSync, createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { sendungsrahmenAus, warteAufAnpfiff } from "./lib/arena-anpfiff.mjs";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = path.join(WURZEL, "public");
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const MIME = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg", ".svg": "image/svg+xml", ".webp": "image/webp",
  ".mp3": "audio/mpeg", ".wav": "audio/wav", ".ogg": "audio/ogg",
};

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
      } catch {
        res.writeHead(404); res.end("not found: " + p);
      }
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

const disziplin = process.argv[2];
if (!disziplin) {
  console.error("Nutzung: node scripts/verify-standkonsistenz-30-09.mjs <disziplin> [ausgabeOrdner]");
  process.exit(1);
}
const ausgabeOrdner = process.argv[3] || path.join(WURZEL, "tmp-ux-audit", "standkonsistenz-30-09");
mkdirSync(ausgabeOrdner, { recursive: true });

const server = await starteServer();
const port = server.address().port;
const SEITE = `http://127.0.0.1:${port}/mockups/battle-mode.html`;
let browser;
try {
  browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
  const seite = await browser.newPage({ viewport: { width: 1300, height: 900 } });
  // PRODUKTIONSMODUS wie im Host (FoundationBattleArenaHost.tsx): dark + .im-spiel.
  await seite.addStyleTag({ content: "body{background:#0B1018}" });
  const fehler = [];
  seite.on("pageerror", (e) => fehler.push(String(e)));
  await seite.goto(SEITE, { waitUntil: "networkidle" });
  await seite.evaluate(() => {
    document.documentElement.setAttribute("data-theme", "dark");
    document.querySelector(".oly-battle-arena")?.classList.add("im-spiel");
  });
  await seite.waitForFunction(() => window.__arena && window.__arena.setDisc, null, { timeout: 30000 });
  const gesetzt = await seite.evaluate((d) => {
    try { window.__arena.setDisc(d); return true; } catch (e) { return String(e); }
  }, disziplin);
  if (gesetzt !== true) {
    console.error("setDisc(" + JSON.stringify(disziplin) + ") schlug fehl: " + gesetzt);
    process.exit(1);
  }
  await seite.click("#t2");
  await seite.click("#play");
  await warteAufAnpfiff(seite); // Sendungsrahmen-Paket 07.10.: Anpfiff-Countdown abwarten, s. scripts/lib/arena-anpfiff.mjs

  const lies = () => seite.evaluate(() => ({
    score: document.getElementById("score")?.textContent?.trim() || null,
    kmitte: document.getElementById("kmitte")?.textContent?.trim() || null,
    bbugMitte: document.getElementById("bbugMitte")?.textContent?.trim() || null,
    bbugHidden: document.getElementById("bbug")?.hidden ?? null,
  }));

  const momente = [
    { name: "einlauf", wartenMs: 500 },
    { name: "mittelspiel", wartenMs: 15000 },
    { name: "ende", wartenMs: 60000 },
  ];
  for (const m of momente) {
    await seite.waitForTimeout(m.wartenMs);
    const zustand = await lies();
    const out = path.join(ausgabeOrdner, `${disziplin}-${m.name}.png`);
    // "#p1 .frame" (Aufstellung) UND "#p2 .frame" (Arena) teilen sich dieselbe Klasse --
    // ohne Scope traf $(".frame") das erste (verstecktes Aufstellungs-Panel) und lief in
    // "element is not visible" (Fable-Fund waehrend dieser Sichtpruefung selbst).
    const frame = await seite.$("#p2 .frame");
    await frame.screenshot({ path: out });
    console.log(`[${disziplin}/${m.name}] score="${zustand.score}" kmitte="${zustand.kmitte}" bbugMitte="${zustand.bbugMitte}" bbugHidden=${zustand.bbugHidden} -> ${out}`);
  }
  console.log("Seitenfehler: " + (fehler.length ? fehler.join(" | ") : "keine"));
} finally {
  if (browser) await browser.close();
  server.close();
}
