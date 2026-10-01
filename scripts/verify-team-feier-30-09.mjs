// SICHTPRUEFUNG fuer PR "team-feier-baukasten-gewichtheben-breaking-30-09" (Konzept
// docs/design/team-publikum-feiermomente-konzept-30-09.md, Phase 1). Kein Teil der Abnahme-
// Sonden -- nur zum Ansehen/Belegen.
//
// Faehrt die Disziplin im deterministischen Sonden-Modus (window.__arena.sondenLauf, also
// pixelstabil und ohne Wanduhr) bis zum ersten "gross"-Moment und nimmt das GESAMTE Arena-Panel
// (#p2 .frame, inklusive der DOM-Overlays Score-Bug/Teamkarten) auf:
//   gewichtheben: der Moment, in dem #score vom 0 : 0 weg springt -- seit dem Score-Fix
//                 (hebenDuellEntschieden) ist das exakt der Lampen-Tick der Duell-Entscheidung,
//                 also derselbe Tick, in dem hebenFeierAmUrteil() die grosse Feier ausloest.
//   breaking:     der Moment, in dem #score (noch stehende Kaempfer) zum ersten Mal sinkt --
//                 derselbe Tick, in dem stepBuehne() den Bruch enthuellt und die Feier ausloest.
// Aufgenommen wird je +2, +20 (~300ms spaeter) und +60 Ticks nach dem Ausloeser, dazu ein Bild
// VOR dem Ausloeser (Ruhezustand der Bank). Mit "--finale" zusaetzlich die Stufe "finale" ueber
// window.__arena.teamFeierProbe() (in Phase 1 ohne organischen Ausloeser, s. Modulkopf).
//
// Aufruf: node scripts/verify-team-feier-30-09.mjs <gewichtheben|breaking> [ausgabeOrdner] [--finale]
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

const args = process.argv.slice(2);
const FINALE = args.includes("--finale");
const [disziplin, ordnerArg] = args.filter((a) => !a.startsWith("--"));
if (disziplin !== "gewichtheben" && disziplin !== "breaking") {
  console.error("Nutzung: node scripts/verify-team-feier-30-09.mjs <gewichtheben|breaking> [ausgabeOrdner] [--finale]");
  process.exit(1);
}
const ausgabeOrdner = ordnerArg || path.join(WURZEL, "tmp-ux-audit", "team-feier-30-09");
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
  // Wie der Host: data-theme="dark" + .im-spiel auf der Arena-Wurzel (.oly-battle-arena).
  await seite.evaluate(() => {
    document.documentElement.setAttribute("data-theme", "dark");
    const wurzel = document.querySelector(".oly-battle-arena");
    wurzel?.setAttribute("data-theme", "dark");
    wurzel?.classList.add("im-spiel");
  });
  await seite.waitForFunction(() => window.__arena && window.__arena.setDisc, null, { timeout: 30000 });
  await seite.click("#t2");
  await seite.evaluate((d) => window.__arena.setDisc(d), disziplin);
  // Sprites/Texturen fertig laden lassen, bevor die erste Aufnahme faellt.
  await seite.waitForTimeout(1500);

  const score = () => seite.evaluate(() => document.getElementById("score")?.textContent?.trim() || "");
  // Die Einlauf-Karte (#einlauf) blendet im echten Spiel der Anpfiff aus; der Sonden-Modus
  // startet ohne "Auftakt"-Klick, deshalb hier dieselbe Ausblendung von Hand.
  const lauf = (n) => seite.evaluate((k) => {
    const e = document.getElementById("einlauf"); if (e) e.hidden = true;
    return window.__arena.sondenLauf(k);
  }, n);
  const aufnahme = async (name) => {
    const out = path.join(ausgabeOrdner, `${disziplin}-${name}.png`);
    const frame = await seite.$("#p2 .frame");
    await frame.screenshot({ path: out });
    // Zusaetzlich die Leinwand in voller Aufloesung (1240x470) -- im Panel ist sie ~0,77-fach
    // verkleinert, Huepfer und Konfetti sind dort nur schwer zu beurteilen.
    await (await seite.$("#cv")).screenshot({ path: out.replace(/\.png$/, "-leinwand.png") });
    console.log(`[${disziplin}/${name}] score="${await score()}" -> ${out}`);
  };

  const start = await score();
  const zahlen = (s) => (s.match(/\d+/g) || []).map(Number);
  const ausgeloest = (s) => {
    if (disziplin === "gewichtheben") return s !== start && zahlen(s).reduce((a, b) => a + b, 0) > 0;
    const [a0, b0] = zahlen(start), [a, b] = zahlen(s);
    return a + b < a0 + b0;
  };
  // Grob in 30er-Schritten bis kurz vor den Ausloeser, dann tickgenau.
  let ticks = 0, vorher = null;
  while (ticks < 60 * 60 * 12) {
    await lauf(30); ticks += 30;
    if (ausgeloest(await score())) break;
  }
  // Zurueck ist im Sonden-Modus nicht moeglich -- die tickgenaue Suche laeuft deshalb in einem
  // zweiten, identischen Durchgang (setDisc() nullt Sonden-Uhr und Aufstellung, s. reset()).
  const ziel = ticks;
  await seite.evaluate((d) => window.__arena.setDisc(d), disziplin);
  await lauf(Math.max(0, ziel - 90)); ticks = Math.max(0, ziel - 90);
  await aufnahme("0-ruhe-vorher");
  while (ticks < ziel + 30) {
    await lauf(1); ticks += 1;
    if (ausgeloest(await score())) break;
  }
  console.log(`Ausloeser bei Tick ${ticks} (score "${start}" -> "${await score()}")`);
  await lauf(2); await aufnahme("1-gross-plus2");
  await lauf(18); await aufnahme("2-gross-plus20");
  await lauf(40); await aufnahme("3-gross-plus60");
  if (FINALE) {
    await seite.evaluate(() => window.__arena.teamFeierProbe(0, "finale"));
    await lauf(20); await aufnahme("4-finale-probe-plus20");
    await lauf(25); await aufnahme("5-finale-probe-plus45");
  }
  vorher = fehler;
  console.log("Seitenfehler: " + (vorher.length ? vorher.join(" | ") : "keine"));
} finally {
  if (browser) await browser.close();
  server.close();
}
