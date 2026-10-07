// VERIFIKATION BROADCAST-PAKET A (Feldspiel-Endstand und Uhr, 06.10.): spielt Football,
// Hockey und Basketball je einmal volldeterministisch durch (window.__arena.sondenLauf(),
// s. dessen Kopfkommentar in battle-mode.engine.js -- feste Tick-Groesse statt echter
// Wanduhr, damit zwei Laeufe mit derselben Saat exakt dasselbe Ergebnis liefern) und prueft:
//
//   (a) die Zahl im Endstand-Banner (#esieger) ist identisch zur zuletzt gezeigten
//       Scoreline (#score)
//   (b) die Uhr-Anzeige (#clock) enthaelt zu KEINEM Messzeitpunkt ein "+"
//   (c) die Linescore-Summe (#elinescore) ergibt den Endstand
//   (d) der Ticker-Zeitstempel der Schlusszeile liegt im erwarteten skalierten Bereich
//       (anzeigeT = fsT*zeitFaktor() soll der REALEN Tick-Zahl/60 entsprechen, s. feed())
//   (e) Endstand-Tafeln (#etafelL/#etafelR/#elinescore) haben keinen horizontalen Ueberlauf
//
// Playwright/sondenLauf statt Klick+waitForTimeout (A0.2-Muster, s. verify-football-punkt1.mjs
// und den sondenLauf()-Kopfkommentar): kein Banner-Timing wird hier geprueft (das verlangt laut
// Auftrag echte Zeit, s. dort), nur Endzustand und waehrend des Laufs gesammelte Momentaufnahmen.
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { existsSync, mkdirSync, createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = path.join(WURZEL, "public");
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png" };

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
      } catch { res.writeHead(404); res.end("not found: " + p); }
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

const ausgabeOrdner = path.join(WURZEL, "tmp-ux-audit", "broadcast-paket-a-06-10");
mkdirSync(ausgabeOrdner, { recursive: true });
const server = await starteServer();
const port = server.address().port;
const SEITE = `http://127.0.0.1:${port}/mockups/battle-mode.html`;

// Erwartete Gesamt-Spieldauer (Simulationssekunden) je Disziplin, aus deren `live:{perioden,
// periodenDauer}`-Konfiguration in battle-mode.engine.js (FELDSPIEL_ART.*.live, Stand 06.10.):
// football 4x70, hockey 3x80, basketball 4x90. Die ERWARTETE Ticker-Schlusszeit ist diese
// Zahl * zeitFaktor() (ZEIT_DEHNUNG-Tabelle, ebenda) -- GENAU die Groesse, die Punkt 3 des
// Pakets (`anzeigeT=fsT*zeitFaktor()`) jetzt im Ticker zeigen soll. Zum Vergleich dient NICHT
// die rohe Sonden-Tick-Zahl (die laeuft durch Freiwurf-/Viertelpausen-Standphasen schneller
// als die Spieluhr, s. deren `fsT`-Stopp in stepFeldspielLive) -- dieselbe Erwartung wie sie
// die Kopfzeilen-Uhr selbst zeigt.
const SIMDAUER_SEK = { football: 4 * 70, hockey: 3 * 80, basketball: 4 * 90 };
const ZEITFAKTOR_ERWARTET = { football: 1, hockey: 2, basketball: 1 };

const DISZIPLINEN = ["football", "hockey", "basketball"];
let alleOk = true;

let browser;
try {
  browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
  const seite = await browser.newPage({ viewport: { width: 1300, height: 900 } });
  await seite.addStyleTag({ content: "body{background:#0B1018}" });
  await seite.goto(SEITE, { waitUntil: "networkidle" });
  await seite.evaluate(() => {
    document.documentElement.setAttribute("data-theme", "dark");
    document.querySelector(".oly-battle-arena")?.classList.add("im-spiel");
  });
  await seite.waitForFunction(() => window.__arena && window.__arena.setDisc && window.__arena.sondenLauf, null, { timeout: 30000 });
  await sendungsrahmenAus(seite); // Sendungsrahmen-Paket 07.10.: Countdown/Finale-in-Echtzeit/Endstand-Nachlauf aus -- diese Sonde misst bis zum Endstand bzw. per sondenLauf(), s. scripts/lib/arena-anpfiff.mjs

  for (const disc of DISZIPLINEN) {
    console.log(`\n=== ${disc} ===`);
    await seite.click("#t2").catch(() => {}); // Arena-Tab, falls noch auf "Aufstellung"
    const zf = await seite.evaluate((d) => {
      window.__arena.setDisc(d);
      return window.__arena.sondenLauf(0).zeitFaktor;
    }, disc);

    const BATCH = 600; // 10 Sim-Takte je Aufruf
    const MAX_TICKS = 60000; // grosszuegige Deckelung (>: 16,6 Minuten reale Sonden-Zeit)
    let ticksGesamt = 0;
    let clockHatPlus = false;
    const clockBeobachtungen = [];
    let fertig = false;

    while (ticksGesamt < MAX_TICKS && !fertig) {
      await seite.evaluate((n) => window.__arena.sondenLauf(n), BATCH);
      ticksGesamt += BATCH;
      const stand = await seite.evaluate(() => ({
        phase: document.getElementById("phase")?.textContent || "",
        clock: document.getElementById("clock")?.textContent || "",
      }));
      clockBeobachtungen.push(stand.clock);
      if (stand.clock.includes("+")) clockHatPlus = true;
      if (stand.phase === "beendet") fertig = true;
    }

    if (!fertig) {
      console.log(`  FEHLER: Spiel wurde nach ${ticksGesamt} Ticks nicht "beendet" -- Abbruch.`);
      alleOk = false;
      continue;
    }

    const endzustand = await seite.evaluate(() => {
      const score = document.getElementById("score")?.textContent?.trim() || "";
      const esieger = document.getElementById("esieger")?.textContent?.trim() || "";
      const feedZeilen = Array.from(document.querySelectorAll("#feed div")).map(d => d.textContent.trim());
      const linescoreZellen = Array.from(document.querySelectorAll("#elinescore table tr")).map(
        tr => Array.from(tr.children).map(td => td.textContent.trim())
      );
      const overflow = (id) => {
        const el = document.getElementById(id);
        if (!el) return null;
        return { scrollWidth: el.scrollWidth, clientWidth: el.clientWidth, ueber: el.scrollWidth > el.clientWidth + 1 };
      };
      return {
        score, esieger, feedZeilen, linescoreZellen,
        overflow: { etafelL: overflow("etafelL"), etafelR: overflow("etafelR"), elinescore: overflow("elinescore") },
      };
    });

    // (a) Endstand-Banner-Zahl == Scoreline-Zahl
    const scoreZahlen = (endzustand.score.match(/\d+/g) || []).map(Number);
    const siegerZahlen = (endzustand.esieger.match(/\d+/g) || []).map(Number);
    const aOk = scoreZahlen.length === 2 && siegerZahlen.length >= 2
      && siegerZahlen.slice(-2).join(":") === scoreZahlen.join(":");
    console.log(`  (a) Endstand="${endzustand.esieger}" vs Score="${endzustand.score}" -> ${aOk ? "OK" : "FEHLER"}`);
    if (!aOk) alleOk = false;

    // (b) Uhr nie mit "+"
    console.log(`  (b) "${clockBeobachtungen.length}" Clock-Messpunkte, "+" gesehen: ${clockHatPlus} -> ${!clockHatPlus ? "OK" : "FEHLER"}`);
    if (clockHatPlus) alleOk = false;

    // (c) Linescore-Summe == Endstand
    let cOk = false;
    if (endzustand.linescoreZellen.length >= 3) {
      const [, ...zeilen] = endzustand.linescoreZellen; // erste Zeile ist der Kopf
      const summen = zeilen.map(z => {
        const periodenSpalten = z.slice(1, -1).map(Number);
        const gesamt = Number(z[z.length - 1]);
        return { summe: periodenSpalten.reduce((a, b) => a + b, 0), gesamt };
      });
      cOk = summen.length === 2 && summen.every(s => s.summe === s.gesamt) && summen.map(s => s.gesamt).join(":") === scoreZahlen.join(":");
      console.log(`  (c) Linescore: ${JSON.stringify(endzustand.linescoreZellen)} -> ${cOk ? "OK" : "FEHLER"}`);
    } else {
      console.log(`  (c) FEHLER: keine Linescore-Tabelle gefunden (${JSON.stringify(endzustand.linescoreZellen)})`);
    }
    if (!cOk) alleOk = false;

    // (d) Ticker-Zeitstempel der Schlusszeile im erwarteten (skalierten) Bereich.
    // Erwartung: anzeigeT = fsT*zeitFaktor() = reale Tick-Zahl/60 (s. feed()/sondenLauf()-
    // Kommentar) -- die Schlusssirene wird GENAU im letzten verarbeiteten Tick gefeuert,
    // Toleranz 5s fuer Rundung/vorgelagerte Zwischenstand-Zeilen.
    const letzteSchlusszeile = [...endzustand.feedZeilen].reverse().find(z => /Schlusssirene/.test(z));
    let dOk = false;
    if (letzteSchlusszeile) {
      // Zeitstempel steht NICHT im Feed-Text selbst (der ist in einem eigenen <span>), daher
      // wird er separat aus dem DOM gelesen.
      const tickerZeit = await seite.evaluate(() => {
        const zeilen = Array.from(document.querySelectorAll("#feed div"));
        const letzte = [...zeilen].reverse().find(d => /Schlusssirene/.test(d.textContent));
        if (!letzte) return null;
        const tk = letzte.querySelector(".tk");
        return tk ? tk.textContent.trim() : null;
      });
      if (tickerZeit) {
        const [mm, ss] = tickerZeit.split(":").map(Number);
        const gezeigteSek = mm * 60 + ss;
        const erwarteteSek = SIMDAUER_SEK[disc] * ZEITFAKTOR_ERWARTET[disc];
        dOk = Math.abs(gezeigteSek - erwarteteSek) <= 5;
        console.log(`  (d) Ticker-Schlusszeit="${tickerZeit}" (${gezeigteSek}s) vs erwartet ~${erwarteteSek}s (zeitFaktor=${zf}) -> ${dOk ? "OK" : "FEHLER"}`);
      } else {
        console.log(`  (d) FEHLER: kein Zeitstempel zur Schlusssirene gefunden`);
      }
    } else {
      console.log(`  (d) FEHLER: keine Schlusssirenen-Zeile im Ticker gefunden`);
    }
    if (!dOk) alleOk = false;

    // (e) kein horizontaler Ueberlauf
    const eOk = Object.values(endzustand.overflow).every(o => o && !o.ueber);
    console.log(`  (e) Overflow: ${JSON.stringify(endzustand.overflow)} -> ${eOk ? "OK" : "FEHLER"}`);
    if (!eOk) alleOk = false;

    // Sichtprobe
    const out = path.join(ausgabeOrdner, `${disc}-endstand.png`);
    const frame = await seite.$("#p2 .frame");
    if (frame) await frame.screenshot({ path: out });
    console.log(`  Screenshot: ${out}`);
  }
} finally {
  if (browser) await browser.close();
  server.close();
}

console.log(`\n=== GESAMT: ${alleOk ? "ALLE PRUEFUNGEN BESTANDEN" : "MINDESTENS EINE PRUEFUNG FEHLGESCHLAGEN"} ===`);
process.exit(alleOk ? 0 : 1);
