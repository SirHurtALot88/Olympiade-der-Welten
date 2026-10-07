// VERIFIKATION BREAKING-BROADCAST-PAKET (07.10., docs/design/breaking-broadcast-paket-plan-
// 07-10.md Abschnitt 5, Schritt 7): spielt Breaking einmal volldeterministisch durch
// (window.__arena.sondenLauf(), feste Tick-Groesse statt echter Wanduhr) und prueft, dass
// T1 (Ticker-Regression), B1 (kein Stufenwechsel-Banner) und S1-S3 (Stand-Darstellung)
// zutreffen:
//
//   (a) zu KEINEM Probezeitpunkt zeigen #score und #kmitte zwei verschiedene Zahlenpaare
//       (seit S2 liest renderKader() dieselbe buehneStand()-Quelle wie updateHudBuehne())
//   (b) #klsuffix = "Verbliebene", Endstand-Banner enthaelt "Verbliebene"
//   (c) Team-Unterzeile: Wort "ausgeschieden", BEIDE Seiten "0" beim allerersten Tick (S3 --
//       der Spoiler trat frueher schon vor dem ersten Zug auf, s. Plan Abschnitt 3.2)
//   (d) jeder Callout-Banner-Text ist entweder eine Aufgabe ("scheidet aus"/GEBROCHEN/GIBT AUF)
//       oder der Endstand -- NIE ein Stufenwechsel ("haelt stand"/"bricht ein" als Banner, Titel
//       "ANGESCHLAGEN"). B1 macht das strukturell unmoeglich (big ist im Stufenwechsel-Zweig
//       fest `false`); dieser Check bestaetigt es am Laufzeitverhalten statt nur am Code.
//   (e) Endstand-Zahl = letzte Scoreline = Zahl in der Schluss-Tickerzeile
//   (f) sichtbarer Ticker bleibt unter 30 Zeilen je Minute Sendezeit (T1), Protokoll-
//       Zeilenzahl ist exakt die, die miss-ticker-dichte.mjs ohne Fix schon zaehlt (297)
//   (g) keine `pageerror`
//
// EIN LAUF STATT FUENF AUFSTELLUNGEN (vereinfacht gegenueber Plan Abschnitt 1): der Plan hat
// fuenf Aufstellungen gebraucht, um den seltenen gegenlaeufigen PKT-vs-Verbliebene-Fall
// MESSBAR zu machen (1,1 % der Proben). Seit S2 gibt es diese zweite Zahl in #kmitte gar
// nicht mehr -- buehneStand() ist fuer #score UND #kmitte dieselbe Quelle, unabhaengig von
// der Aufstellung. Ein Lauf mit dem Standardkader deckt die vier strukturellen Fixes
// (T1/B1/S1-S3) vollstaendig ab; die Aufstellungsvielfalt war ein Diagnose-, kein
// Abnahme-Werkzeug.
//
// EINE EINZIGE evaluate()-SCHLEIFE (sondenLauf(3) in kleinen Schritten), nicht viele
// Rundreisen: siehe docs/design/breaking-performance-einbruch-befund-01-10.md -- viele kleine
// Playwright-Rundreisen loesen bei Breaking einen Performance-Einbruch nach ~250-400 Ticks aus.
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { existsSync, mkdirSync, createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { sendungsrahmenAus, warteAufAnpfiff } from "./lib/arena-anpfiff.mjs";

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

const ausgabeOrdner = path.join(WURZEL, "tmp-ux-audit", "breaking-broadcast-paket-07-10");
mkdirSync(ausgabeOrdner, { recursive: true });
const server = await starteServer();
const port = server.address().port;
const SEITE = `http://127.0.0.1:${port}/mockups/battle-mode.html`;

const TICKER_SCHRANKE_JE_MIN = 30;
const PROTOKOLL_VORHER = 297;
const SCHRITT = 3; // kleine Schritte gegen den Performance-Einbruch, s. Kopfkommentar
const MAX_TICKS = 60 * 60 * 10;

let alleOk = true;

let browser;
try {
  browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
  const seite = await browser.newPage({ viewport: { width: 1300, height: 900 } });
  const fehler = [];
  seite.on("pageerror", (e) => fehler.push(String(e)));
  await seite.addStyleTag({ content: "body{background:#0B1018}" }).catch(() => {});
  await seite.goto(SEITE, { waitUntil: "networkidle" });
  await seite.evaluate(() => {
    document.documentElement.setAttribute("data-theme", "dark");
    document.querySelector(".oly-battle-arena")?.setAttribute("data-theme", "dark");
    document.querySelector(".oly-battle-arena")?.classList.add("im-spiel");
  });
  await seite.waitForFunction(() => window.__arena && window.__arena.setDisc && window.__arena.sondenLauf, null, { timeout: 30000 });
  await sendungsrahmenAus(seite); // Sendungsrahmen-Paket 07.10.: Endstand-Nachlauf (und Countdown/Finale) aus -- die Ticker-Dichte zaehlt Ticks bis #endstand, 3,5 s Nachlauf wuerden sie verduennen, s. scripts/lib/arena-anpfiff.mjs
  await seite.evaluate(() => window.__arena.setDisc("breaking"));
  await seite.click("#t2").catch(() => {});
  await seite.evaluate(() => { const e = document.getElementById("einlauf"); if (e) e.hidden = true; });

  // Ticker-/Protokoll-Zaehler, Muster aus miss-ticker-dichte.mjs.
  await seite.evaluate(() => {
    const zeile = (n) => ({ txt: n.textContent, big: !!n.querySelector(".big") });
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

  // EINE EINZIGE evaluate()-Rundreise fuer den ganzen Lauf (s. Kopfkommentar): die Schleife
  // selbst laeuft im Seitenkontext, Node bekommt erst am Ende das gesammelte Ergebnis. Viele
  // kleine Node<->Browser-Rundreisen sind genau das, was den Performance-Einbruch aus
  // breaking-performance-einbruch-befund-01-10.md ausloest.
  const ergebnis = await seite.evaluate(({ schritt, maxTicks }) => {
    const txt = (id) => document.getElementById(id)?.textContent?.trim() || "";
    const paar = (s) => { const m = s.match(/^(\d+)\s*:\s*(\d+)$/); return m ? m[1] + ":" + m[2] : null; };
    const probenStandWiderspruch = [];
    const bannerTexte = [];
    let letzterBannerText = null;
    let ersterSublineGesehen = null;
    let ticks = 0;
    let fertig = false;

    while (ticks < maxTicks && !fertig) {
      window.__arena.sondenLauf(schritt);
      ticks += schritt;
      const banner = document.getElementById("bbugcallout");
      const bannerSichtbar = !!banner && !banner.hidden;
      const bannerText = banner ? (banner.querySelector(".cosatz")?.textContent || banner.textContent || "").trim() : null;
      const bannerTitel = banner ? (banner.querySelector(".cotitel")?.textContent || "").trim() : null;
      const score = txt("score"), kmitte = txt("kmitte");
      const subline = [...document.querySelectorAll(".scoreline .tname em")].map((e) => e.textContent.trim());

      const scorePaar = paar(score), kmittePaar = paar(kmitte);
      if (scorePaar && kmittePaar && scorePaar !== kmittePaar) {
        probenStandWiderspruch.push({ tick: ticks, score, kmitte });
      }
      if (ersterSublineGesehen === null) ersterSublineGesehen = subline;
      if (bannerSichtbar && bannerText && bannerText !== letzterBannerText) {
        bannerTexte.push([bannerText, bannerTitel]);
        letzterBannerText = bannerText;
      } else if (!bannerSichtbar) {
        letzterBannerText = null;
      }
      if (txt("phase") === "beendet") fertig = true;
    }
    return { probenStandWiderspruch, bannerTexte, ersterSublineGesehen, ticks, fertig };
  }, { schritt: SCHRITT, maxTicks: MAX_TICKS });

  const { probenStandWiderspruch, ersterSublineGesehen } = ergebnis;
  const bannerTexte = new Map(ergebnis.bannerTexte);
  const ticks = ergebnis.ticks;
  const fertig = ergebnis.fertig;

  if (!fertig) {
    console.log(`FEHLER: Spiel wurde nach ${ticks} Ticks nicht "beendet" -- Abbruch.`);
    alleOk = false;
  }

  await seite.waitForTimeout(300); // Nachlauf: Sieg-/Schlusszeile
  const z = await seite.evaluate(() => ({
    feed: window.__tickerZaehler.feed,
    prot: window.__tickerZaehler.prot,
  }));
  const endzustand = await seite.evaluate(() => ({
    score: document.getElementById("score")?.textContent?.trim() || "",
    esieger: document.getElementById("esieger")?.textContent?.trim() || "",
    klsuffix: document.getElementById("klsuffix")?.textContent?.trim() || "",
  }));

  // (a) Zusammenfassung
  const aOk = probenStandWiderspruch.length === 0;
  console.log(`(a) Stand-Widersprueche ueber ${ticks / 60} s Sendezeit: ${probenStandWiderspruch.length} -> ${aOk ? "OK" : "FEHLER"}`);
  if (!aOk) console.log(`    Beispiele: ${JSON.stringify(probenStandWiderspruch.slice(0, 3))}`);
  if (!aOk) alleOk = false;

  // (b) Beschriftung
  const bOk = endzustand.klsuffix === "Verbliebene" && endzustand.esieger.includes("Verbliebene");
  console.log(`(b) klsuffix="${endzustand.klsuffix}", esieger="${endzustand.esieger}" -> ${bOk ? "OK" : "FEHLER"}`);
  if (!bOk) alleOk = false;

  // (c) kein Spoiler beim ersten Tick
  const cOk = Array.isArray(ersterSublineGesehen) && ersterSublineGesehen.every((t) => /\b0\s+ausgeschieden\b/.test(t));
  console.log(`(c) Team-Unterzeile beim ersten Tick: ${JSON.stringify(ersterSublineGesehen)} -> ${cOk ? "OK" : "FEHLER"}`);
  if (!cOk) alleOk = false;

  // (d) jeder Banner ist eine Aufgabe oder der Endstand, nie ein Stufenwechsel
  const erlaubtesBanner = /scheidet aus|GEBROCHEN|GIBT AUF|gewinnt|ENDSTAND/;
  const verboteneTitel = new Set(["ANGESCHLAGEN"]);
  const bannerFehler = [...bannerTexte.entries()].filter(
    ([text, titel]) => verboteneTitel.has(titel) || !erlaubtesBanner.test(text + " " + (titel || "")),
  );
  const dOk = bannerFehler.length === 0 && bannerTexte.size > 0;
  console.log(`(d) ${bannerTexte.size} verschiedene Banner gesehen, Verstoesse: ${bannerFehler.length} -> ${dOk ? "OK" : "FEHLER"}`);
  if (!dOk) console.log(`    Banner: ${JSON.stringify([...bannerTexte.entries()])}`);
  if (!dOk) alleOk = false;

  // (e) Endstand-Zahl == letzte Scoreline == Schluss-Tickerzeile
  const scoreZahlen = (endzustand.score.match(/\d+/g) || []).map(Number);
  const siegerZahlen = (endzustand.esieger.match(/\d+/g) || []).map(Number);
  const letzteSiegZeile = [...z.feed].reverse().find((f) => /gewinnt/.test(f.txt));
  const siegZeileZahlen = letzteSiegZeile ? (letzteSiegZeile.txt.match(/\d+/g) || []).map(Number) : [];
  const eOk = scoreZahlen.length === 2 && siegerZahlen.slice(-2).join(":") === scoreZahlen.join(":")
    && (siegZeileZahlen.length === 0 || siegZeileZahlen.slice(-2).join(":") === scoreZahlen.join(":"));
  console.log(`(e) Score="${endzustand.score}" Endstand="${endzustand.esieger}" Schlusszeile="${letzteSiegZeile?.txt || "(keine)"}" -> ${eOk ? "OK" : "FEHLER"}`);
  if (!eOk) alleOk = false;

  // (f) Ticker-Dichte und Protokoll-Vollstaendigkeit
  const minuten = ticks / 60 / 60;
  const jeMin = z.feed.length / minuten;
  const fOk = jeMin <= TICKER_SCHRANKE_JE_MIN && z.prot.length === PROTOKOLL_VORHER;
  console.log(`(f) Ticker ${jeMin.toFixed(1)}/min (Schranke ${TICKER_SCHRANKE_JE_MIN}), Protokoll ${z.prot.length} (erwartet ${PROTOKOLL_VORHER}) -> ${fOk ? "OK" : "FEHLER"}`);
  if (!fOk) alleOk = false;

  // (g) keine Seitenfehler
  const gOk = fehler.length === 0;
  console.log(`(g) Seitenfehler: ${gOk ? "keine" : fehler.join(" | ")} -> ${gOk ? "OK" : "FEHLER"}`);
  if (!gOk) alleOk = false;

  const out = path.join(ausgabeOrdner, "breaking-endstand.png");
  const frame = await seite.$("#p2 .frame");
  if (frame) await frame.screenshot({ path: out });
  console.log(`Screenshot: ${out}`);

  await seite.close();
} finally {
  if (browser) await browser.close();
  server.close();
}

console.log(`\n=== GESAMT: ${alleOk ? "ALLE PRUEFUNGEN BESTANDEN" : "MINDESTENS EINE PRUEFUNG FEHLGESCHLAGEN"} ===`);
process.exit(alleOk ? 0 : 1);
