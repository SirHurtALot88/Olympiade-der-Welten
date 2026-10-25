// TICKER-DICHTE-SONDE (F1-Broadcast-Audit Runde 2, 30.09., Prio-1-Punkt 8 "Ticker
// entschlacken", Zielband <= 30 Zeilen je Minute im sichtbaren Ticker, Messanhang 6.1).
//
// Misst je Disziplin, wie viele Zeilen der sichtbare Ticker (#feed) je Minute Sendezeit
// schreibt -- und, sobald es ihn gibt, wie viele Zeilen das vollstaendige Protokoll
// (#protokoll) im selben Spiel erhaelt. Keine Abnahme-Sonde fuer Wertung/rho, nur Anzeige.
//
// DETERMINISTISCH STATT WANDUHR: der Audit hat bei Tempo 1x in Echtzeit abgetastet (je
// Disziplin bis zu 7:50 Minuten). Hier faehrt window.__arena.sondenLauf(ticks) dieselbe
// stepSim()-Folge in festen Sechzigstel-Schritten -- genau die Schritte, die loop() bei
// Tempo 1x je echter Sechzigstelsekunde ausfuehrt (acc+=dt*speed; je 1/60 ein stepSim()).
// Ein Tick ist damit exakt 1/60 s Sendezeit bei Tempo 1x; die Dauer unten ist Ticks/60 und
// laesst sich direkt gegen die "Dauer 1x"-Spalte aus Tabelle 6.1 legen. Gleiche Kader,
// gleiche Saat -> gleiche Zahl, unabhaengig von Rechnerlast.
//
// GEZAEHLT wird ueber einen MutationObserver auf #feed (jede neu angehaengte Zeile mit
// Zeitstempel-Span .tk), nicht ueber den DOM-Endstand -- der Ticker deckelt sich selbst auf
// 140 Zeilen, ein langes Spiel zeigt am Ende nur noch den Schwanz (s.
// zaehle-kampf-highlights.mjs). Die Sammelzeile "+N im Protokoll" (Klasse .tkmehr) wird
// an Ort und Stelle aktualisiert und zaehlt nicht als neue Zeile.
//
// Aufruf: node scripts/miss-ticker-dichte.mjs [disziplin,disziplin,...] [--zeilen datei.json]
//   [--schranke n]
//   ohne Disziplinliste: die fuenf, die der Audit fuer Punkt 8 nennt, plus Battlefield.
//   --zeilen schreibt zusaetzlich alle Ticker-/Protokollzeilen je Disziplin als JSON.
//   --schranke n (TDM-Broadcast-Paket, 07.10., docs/design/tdm-broadcast-paket-plan-07-10.md
//   Abschnitt 2.5): Exit-Code 1, wenn mindestens eine Disziplin ueber n Ticker-Zeilen je
//   Minute liegt -- ohne den Schalter bleibt das Verhalten wie bisher (reine Ausgabe, immer
//   Exit 0). Die Sonde kannte bisher keine Schranke und gab nur eine Tabelle aus; genau das
//   liess die Regression vom 01.10. (TDM 23 -> 349 Zeilen/min durch Merge 0fd081b3d noch am
//   selben Tag) unbemerkt durchrutschen, s. Plan Abschnitt 2.5.
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { existsSync, createReadStream, statSync, writeFileSync } from "node:fs";
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

const args = process.argv.slice(2);
const zeilenIdx = args.indexOf("--zeilen");
const zeilenDatei = zeilenIdx >= 0 ? args[zeilenIdx + 1] : null;
const schrankeIdx = args.indexOf("--schranke");
const schranke = schrankeIdx >= 0 ? Number(args[schrankeIdx + 1]) : null;
const positional = args.filter((a, i) =>
  !a.startsWith("--") && (zeilenIdx < 0 || i !== zeilenIdx + 1) && (schrankeIdx < 0 || i !== schrankeIdx + 1));
const DISZIPLINEN = (positional[0] || "tdm,battlefield,eiskunstlauf,speed-schach,tennis,takeshis-castle")
  .split(",").map((s) => s.trim()).filter(Boolean);
// Obergrenze je Spiel: 10 Minuten Sendezeit (Hockey, das laengste, misst laut Audit 7:50).
const MAX_TICKS = 60 * 60 * 10;
const SCHRITT = 60;

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
const alleZeilen = {};
const jeMin = {};
let browser;
try {
  browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
  console.log("Disziplin        Dauer 1x  Ticker-Zeilen  je min   Protokoll  je min   ausgeblendet");
  for (const disc of DISZIPLINEN) {
    const seite = await browser.newPage({ viewport: { width: 1300, height: 900 } });
    const fehler = [];
    seite.on("pageerror", (e) => fehler.push(String(e)));
    await seite.goto(SEITE, { waitUntil: "networkidle" });
    await seite.evaluate(() => {
      document.documentElement.setAttribute("data-theme", "dark");
      document.querySelector(".oly-battle-arena")?.setAttribute("data-theme", "dark");
      document.querySelector(".oly-battle-arena")?.classList.add("im-spiel");
    });
    await seite.waitForFunction(() => window.__arena && window.__arena.setDisc, null, { timeout: 30000 });
    await sendungsrahmenAus(seite); // Sendungsrahmen-Paket 07.10.: Endstand-Nachlauf (und Countdown/Finale) aus -- die Ticker-Dichte zaehlt Ticks bis #endstand, 3,5 s Nachlauf wuerden sie verduennen, s. scripts/lib/arena-anpfiff.mjs
    await seite.evaluate((d) => window.__arena.setDisc(d), disc);
    await seite.click("#t2");
    await seite.evaluate(() => {
      const zeile = (n) => ({
        tk: n.querySelector(".tk")?.textContent || "",
        txt: [...n.children].filter((c) => !c.classList.contains("tk")).map((c) => c.textContent).join(" "),
        big: !!n.querySelector(".big"),
      });
      window.__tickerZaehler = { feed: [], prot: [] };
      const beobachte = (id, ziel) => {
        const box = document.getElementById(id);
        if (!box) return;
        new MutationObserver((ms) => {
          for (const m of ms) for (const n of m.addedNodes) {
            if (n.nodeType !== 1 || !n.querySelector || !n.querySelector(".tk")) continue;
            if (n.classList.contains("tkmehr")) continue;
            ziel.push(zeile(n));
          }
        }).observe(box, { childList: true, subtree: true });
      };
      beobachte("feed", window.__tickerZaehler.feed);
      beobachte("protokoll", window.__tickerZaehler.prot);
    });
    let ticks = 0;
    while (ticks < MAX_TICKS) {
      await seite.evaluate((n) => window.__arena.sondenLauf(n), SCHRITT);
      ticks += SCHRITT;
      const ende = await seite.evaluate(() => !document.getElementById("endstand").hidden);
      if (ende) break;
    }
    // Nachlauf: Sieg-Zeile (finish() schreibt sie nach renderEndstand()) und Sammeltimer
    // (z.B. Fechten-Periodenbuendel) sollen noch ankommen.
    await seite.waitForTimeout(300);
    const z = await seite.evaluate(() => ({
      feed: window.__tickerZaehler.feed,
      prot: window.__tickerZaehler.prot,
      mehr: document.querySelector("#feed .tkmehr")?.textContent || null,
    }));
    const min = ticks / 60 / 60;
    const dauer = `${Math.floor(ticks / 3600)}:${String(Math.floor((ticks / 60) % 60)).padStart(2, "0")}`;
    const proT = z.prot.length ? z.prot.length : z.feed.length;
    jeMin[disc] = z.feed.length / min;
    console.log(
      `${disc.padEnd(16)} ${dauer.padStart(8)}  ${String(z.feed.length).padStart(13)}  ${(z.feed.length / min).toFixed(1).padStart(6)}` +
      `   ${String(proT).padStart(9)}  ${(proT / min).toFixed(1).padStart(6)}   ${String(proT - z.feed.length).padStart(12)}` +
      (fehler.length ? `   FEHLER: ${fehler.join(" | ")}` : ""),
    );
    alleZeilen[disc] = { ticks, ...z };
    await seite.close();
  }
} finally {
  if (browser) await browser.close();
  server.close();
}
if (zeilenDatei) writeFileSync(zeilenDatei, JSON.stringify(alleZeilen, null, 1));
if (schranke !== null) {
  const ueberschritten = Object.entries(jeMin).filter(([, n]) => n > schranke);
  if (ueberschritten.length) {
    console.error(
      `\nSCHRANKE (${schranke}/min) ueberschritten: ` +
      ueberschritten.map(([d, n]) => `${d} ${n.toFixed(1)}`).join(", "),
    );
    process.exit(1);
  }
  console.log(`\nSchranke ${schranke}/min eingehalten.`);
}
