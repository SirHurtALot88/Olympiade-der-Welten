// Wie zaehle-tdm-highlights.mjs, aber ueber mehrere Kampf-Disziplinen, die sich denselben
// Kampfmotor (schalteAus/nahschlag/schrittPfeile) teilen -- Beleg, dass die geschaerfte
// Highlight-Auswahl (samt spielweitem Cooldown, s. kampfGrossDrosseln in
// battle-mode.engine.js) fuer mehr als nur TDM greift. Ohne gebuchten Kader
// (window.__olyArenaKader) spielt jede Disziplin ihre eigene, aus SQUAD/OPP sortierte
// Ersatzaufstellung -- schon das liefert unterschiedliche Kaempfe (6v6 TDM, Battlefield mit
// Kontrollpunkt), keine Wiederholung derselben Partie.
//
// GEZAEHLT WIRD UEBER `#ehighlights .ehzeile` (renderHighlights()/HIGHLIGHTS[], nie
// gedeckelt), NICHT ueber `#feed span.big` -- derselbe Fund wie bei
// zaehle-tdm-highlights.mjs: der Ticker deckelt sich selbst auf 140 Zeilen, ein langes Spiel
// zeigt dort am Ende nur noch den Schwanz, nicht die echte Gesamtzahl.
//
// MINI-DM NICHT IM DEFAULT (Nachbesserung 27.09., unabhaengige Review): fuer disc==="mini-dm"
// blendet renderDbar() `.ctrl` (und damit #play/#spd/#t2) komplett aus -- die interaktive
// Host-UI zeigt dort das eigenstaendige 4-Team-FFA-Panel statt der klassischen
// Zwei-Seiten-Steuerung (s. istMdffa-Zweig in battle-mode.engine.js). Ein Playwright-
// `.click()` auf ein bewusst `display:none` gesetztes Element schlaegt fehl, der alte
// Default-Aufruf dieses Skripts brach also schon beim zweiten Eintrag ab. Mini-DM braucht
// eine eigene Sonde (window.__arena.miniDmFfaEvent, nicht diesen Ticker-Weg) -- hier bewusst
// nur die beiden Disziplinen, die tatsaechlich ueber DIESEN Ticker/DIESE Steuerung laufen.
// Wer Mini-DM trotzdem ueber dieses Skript sehen will, kann es weiter explizit als Argument
// uebergeben -- nur der DEFAULT ohne Argument laesst es aus.
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { existsSync, mkdirSync, createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = path.join(WURZEL, "public");
const OUT_DIR = process.argv[3] || path.join(WURZEL, "tmp-ux-audit");
const DISZIPLINEN = (process.argv[2] || "tdm,battlefield").split(",").map(s => s.trim());
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const MIME = { ".html": "text/html", ".js": "text/javascript", ".png": "image/png", ".json": "application/json", ".css": "text/css" };

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

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

const server = await starteServer();
const port = server.address().port;
const SEITE = `http://127.0.0.1:${port}/mockups/battle-mode.html`;
let browser;
const ergebnisse = [];
try {
  browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
  for (const disc of DISZIPLINEN) {
    const seite = await browser.newPage({ viewport: { width: 1300, height: 760 } });
    const fehler = [];
    seite.on("pageerror", (e) => fehler.push(String(e)));
    seite.on("console", (m) => { if (m.type() === "error") fehler.push("console: " + m.text()); });
    await seite.goto(SEITE, { waitUntil: "networkidle" });
    await seite.waitForFunction(() => window.__arena && window.__arena.setDisc, null, { timeout: 30000 });

    await seite.evaluate((d) => window.__arena.setDisc(d), disc);
    await seite.click("#t2");
    await seite.click("#play");
    await seite.click("#spd");
    await seite.click("#spd");

    await seite.waitForFunction(() => {
      const btn = document.getElementById("play");
      return btn && btn.textContent === "Vorbei";
    }, null, { timeout: 90000 });

    const zeilen = await seite.evaluate(() => {
      const feed = document.getElementById("feed");
      const alle = [...feed.querySelectorAll("div")];
      // ECHTE, SPIELWEITE Highlight-Zahl (s. Kopfkommentar): #ehighlights/HIGHLIGHTS[],
      // nie gedeckelt -- nicht der 140-Zeilen-#feed-DOM-Schnappschuss.
      const ehBox = document.getElementById("ehighlights");
      const ehZeilen = ehBox ? [...ehBox.querySelectorAll(".ehzeile")] : [];
      return {
        gesamt: alle.length,
        big: ehZeilen.length,
        bigTexte: ehZeilen.map(d => d.textContent),
        bigImFeedFenster: alle.filter(d => d.querySelector("span.big")).length,
        routineFaelltBeispiele: alle
          .filter(d => /faellt|ausgeschieden/.test(d.textContent) && !d.querySelector("span.big"))
          .slice(0, 3).map(d => d.textContent),
        routineTrefferBeispiele: alle
          .filter(d => /·\s*\d+$/.test(d.textContent) && !d.querySelector("span.big"))
          .slice(0, 3).map(d => d.textContent),
      };
    });

    ergebnisse.push({ disc, ...zeilen, fehler });
    await seite.close();
  }
} finally {
  if (browser) await browser.close();
  server.close();
}

for (const r of ergebnisse) {
  console.log(`\n=== ${r.disc} ===`);
  console.log(`Ticker-Zeilen gesamt: ${r.gesamt}, ECHTE Highlights (#ehighlights, ungedeckelt): ${r.big}` +
    ` (im #feed-DOM-Fenster am Ende noch sichtbar: ${r.bigImFeedFenster})`);
  console.log("big-Zeilen:");
  for (const t of r.bigTexte) console.log("  * " + t);
  console.log("Beispiele weiterhin im Ticker, aber NICHT big (Faellt/Ausgeschieden):");
  for (const t of r.routineFaelltBeispiele) console.log("  - " + t);
  console.log("Beispiele weiterhin im Ticker, aber NICHT big (Treffer):");
  for (const t of r.routineTrefferBeispiele) console.log("  - " + t);
  if (r.fehler.length) console.log("FEHLER: " + r.fehler.join(" | "));
}
