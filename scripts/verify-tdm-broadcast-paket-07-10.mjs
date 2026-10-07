// VERIFIKATION TDM-BROADCAST-PAKET (07.10., docs/design/tdm-broadcast-paket-plan-07-10.md
// Abschnitt 5, Schritt 5): spielt TDM und Battlefield je einmal volldeterministisch durch
// (window.__arena.sondenLauf(), feste Tick-Groesse statt echter Wanduhr) und prueft, dass
// nach T1 (Ticker-Regression behoben) und S1-S3 (Stand-Darstellung) beide Haupt-Behauptungen
// des Pakets zutreffen:
//
//   (a) zu KEINEM Probezeitpunkt zeigen #score und #kmitte zwei verschiedene Zahlenpaare
//       (seit S2 liest renderKader() dieselbe kampfStandText()-Quelle wie updateHud())
//   (b) #score = Bug-Ziffer (#bbugMitte b) = Summe der KO-Spalte in beiden Wertungstabellen
//       (nur TDM, wo #score = Summe u.st.ko ist -- bei Battlefield ist #score die
//       Lebenden-Ergaenzung, s. kampfStandText())
//   (c) `.ueberzahl` enthaelt, falls sichtbar, kein ":" (S3: "5 v 6" statt "Lebende 5 : 6")
//       und die beiden Zahlen passen zu den sichtbaren Pips
//   (d) #klsuffix = "Ausschaltungen", Endstand-Banner enthaelt "Ausschaltungen"
//   (e) Endstand-Zahl = letzte Scoreline = Zahl in der Schluss-Tickerzeile
//   (f) sichtbarer Ticker bleibt unter 30 Zeilen je Minute Sendezeit (T1), Protokoll-
//       Zeilenzahl ist exakt die, die miss-ticker-dichte.mjs ohne Fix schon zaehlt (nichts
//       geht verloren -- T1 aendert nur, was im sichtbaren #feed landet, nie was in
//       #protokoll steht)
//   (g) keine `pageerror`
//
// Playwright/sondenLauf statt Klick+waitForTimeout (Muster aus
// verify-broadcast-paket-a-06-10.mjs): deterministisch, unabhaengig von Rechnerlast.
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

const ausgabeOrdner = path.join(WURZEL, "tmp-ux-audit", "tdm-broadcast-paket-07-10");
mkdirSync(ausgabeOrdner, { recursive: true });
const server = await starteServer();
const port = server.address().port;
const SEITE = `http://127.0.0.1:${port}/mockups/battle-mode.html`;

// (f) Zielband laut Audit-Punkt 8 / Plan Abschnitt 2.
const TICKER_SCHRANKE_JE_MIN = 30;
// Protokoll-Zeilenzahl zum Vergleich: die Messung von Schritt 0 (vor T1), damit (f) nicht nur
// "nichts hat sich willkuerlich veraendert", sondern konkret "dieselbe Zahl wie vorher" prueft.
const PROTOKOLL_VORHER = { tdm: 1455, battlefield: 303 };

// bannerVsScore (e) und bannerAusschaltungen (d, Banner-Teil) gelten nur fuer TDM: Battlefield
// kann ueber das Kontrollpunkt-Limit gewinnen, dessen Endstand-Banner dann "Kontrollpunkte"
// und die KP-Zahlen zeigt (nicht die Ausschaltungen, die #score zeigt) -- dokumentierter,
// bewusst nicht in diesem Paket behobener Nebenbefund, Plan Abschnitt 3.3.
const KONFIG = {
  tdm: { koCheck: true, bannerAusschaltungen: true, bannerVsScore: true },
  battlefield: { koCheck: false, bannerAusschaltungen: false, bannerVsScore: false },
};
const DISZIPLINEN = Object.keys(KONFIG);

const BATCH = 30; // 0,5 s Sendezeit je Probe, wie in Plan Abschnitt 1 ("Stand")
const MAX_TICKS = 60 * 60 * 10; // 10 Minuten Sendezeit Obergrenze

let alleOk = true;

let browser;
try {
  browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});

  for (const disc of DISZIPLINEN) {
    console.log(`\n=== ${disc} ===`);
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
    await seite.evaluate((d) => window.__arena.setDisc(d), disc);
    await seite.click("#t2").catch(() => {});
    // sondenLauf() geht nie ueber den Start-Knopf -- ohne das bleibt #bbug verborgen (Plan
    // Abschnitt 1, "Einlauf-Overlay wird in der Sonde von Hand ausgeblendet").
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

    const probenStandWiderspruch = [];
    const probenUeberzahlFehler = [];
    let ticks = 0;
    let fertig = false;
    let screenshotUeberzahl = false, screenshotGleichauf = false;

    while (ticks < MAX_TICKS && !fertig) {
      await seite.evaluate((n) => window.__arena.sondenLauf(n), BATCH);
      ticks += BATCH;
      const probe = await seite.evaluate(() => {
        const txt = (id) => document.getElementById(id)?.textContent?.trim() || "";
        const pipZahl = (side, klassen) => {
          const box = document.getElementById(side === 0 ? "bbugL" : "bbugR");
          if (!box) return null;
          return klassen.reduce((n, k) => n + box.querySelectorAll(".pip." + k).length, 0);
        };
        const koSumme = (id) =>
          [...document.querySelectorAll(`#${id} td[data-col="ko"]`)].reduce((s, td) => {
            const v = Number(td.textContent.trim());
            return s + (Number.isFinite(v) ? v : 0);
          }, 0);
        const ueb = document.querySelector("#bbugMitte .ueberzahl");
        const bug = document.getElementById("bbug");
        return {
          phase: txt("phase"),
          score: txt("score"),
          bugSichtbar: !!bug && !bug.hidden,
          bugZiffer: document.querySelector("#bbugMitte b")?.textContent?.trim() || "",
          kmitte: txt("kmitte"),
          ueberzahlText: ueb ? ueb.textContent.trim() : null,
          ueberzahlSichtbar: !!ueb,
          // Nur "an" zaehlt als lebend (live()-Definition: `U.filter(u=>!u.down)`) -- ein
          // "wartet"-Pip (TDM-Respawn) ist noch down, zaehlt also NICHT mit.
          pipsAnL: pipZahl(0, ["an"]),
          pipsAnR: pipZahl(1, ["an"]),
          koL: koSumme("wbodyL"),
          koR: koSumme("wbodyR"),
        };
      });

      // (a) #score vs #kmitte: beide muessen, falls beide ein "a:b" zeigen, DASSELBE Paar sein.
      const paar = (s) => { const m = s.match(/^(\d+)\s*:\s*(\d+)$/); return m ? m[1] + ":" + m[2] : null; };
      const scorePaar = paar(probe.score), kmittePaar = paar(probe.kmitte);
      if (scorePaar && kmittePaar && scorePaar !== kmittePaar) {
        probenStandWiderspruch.push({ tick: ticks, score: probe.score, kmitte: probe.kmitte });
      }
      // Bug-Ziffer ist eine woertliche Kopie von #score (aktualisiereBbug() liest #score
      // NACHDEM updateHud() es gesetzt hat) -- derselbe Vergleich wie oben, aber NUR solange
      // #bbug sichtbar ist: aktualisiereBbug() blendet den Bug bei Spielende aus (`bug.hidden=
      // ...||!!done`) UND kehrt dabei sofort zurueck, OHNE die Mitte neu zu schreiben -- die
      // letzte, jetzt unsichtbare Ziffer bleibt eine Zeile hinter #score zurueck (die naechste
      // Ausschaltung lief schon in dem Tick, der `done` setzte). Fuer den Zuschauer unsichtbar,
      // kein Widerspruch im Bild -- deshalb nur bei bugSichtbar pruefen.
      if (probe.bugSichtbar && scorePaar && probe.bugZiffer && paar(probe.bugZiffer) && paar(probe.bugZiffer) !== scorePaar) {
        probenStandWiderspruch.push({ tick: ticks, score: probe.score, bug: probe.bugZiffer });
      }

      // (b) nur TDM: #score == Σ KO-Spalte.
      if (KONFIG[disc].koCheck && scorePaar) {
        const koPaar = probe.koL + ":" + probe.koR;
        if (koPaar !== scorePaar) probenStandWiderspruch.push({ tick: ticks, score: probe.score, ko: koPaar });
      }

      // (c) .ueberzahl: kein ":" mehr (S3), Zahlen passen zu den Pips.
      if (probe.ueberzahlSichtbar) {
        if (!screenshotUeberzahl) { screenshotUeberzahl = true; }
        if (probe.ueberzahlText.includes(":")) {
          probenUeberzahlFehler.push({ tick: ticks, text: probe.ueberzahlText, grund: "enthaelt ':'" });
        }
        const m = probe.ueberzahlText.match(/^(\d+)\s*v\s*(\d+)$/);
        if (!m) {
          probenUeberzahlFehler.push({ tick: ticks, text: probe.ueberzahlText, grund: "Format nicht 'n v n'" });
        } else if (+m[1] !== probe.pipsAnL || +m[2] !== probe.pipsAnR) {
          probenUeberzahlFehler.push({
            tick: ticks, text: probe.ueberzahlText, grund: `Pips ${probe.pipsAnL}:${probe.pipsAnR} passen nicht`,
          });
        }
      } else if (!screenshotGleichauf && probe.pipsAnL === probe.pipsAnR) {
        screenshotGleichauf = true;
      }

      if (screenshotUeberzahl && !probenUeberzahlFehler.some((f) => f.shot)) {
        const out = path.join(ausgabeOrdner, `${disc}-ueberzahl.png`);
        const frame = await seite.$("#p2 .frame");
        if (frame) { await frame.screenshot({ path: out }); probenUeberzahlFehler.push({ shot: true }); }
      }

      if (probe.phase === "beendet") fertig = true;
    }

    if (!fertig) {
      console.log(`  FEHLER: Spiel wurde nach ${ticks} Ticks nicht "beendet" -- Abbruch.`);
      alleOk = false;
      await seite.close();
      continue;
    }
    // Entfernt die Marker-Eintraege ({shot:true}), die nur den einmaligen Screenshot ausloesten.
    const ueberzahlFehlerEcht = probenUeberzahlFehler.filter((f) => !f.shot);

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

    // (a)/(b)/(c) Zusammenfassung
    const aOk = probenStandWiderspruch.length === 0;
    console.log(`  (a/b) Stand-Widersprueche ueber ${ticks / 60} s Sendezeit: ${probenStandWiderspruch.length} -> ${aOk ? "OK" : "FEHLER"}`);
    if (!aOk) console.log(`        Beispiele: ${JSON.stringify(probenStandWiderspruch.slice(0, 3))}`);
    if (!aOk) alleOk = false;

    const cOk = ueberzahlFehlerEcht.length === 0;
    console.log(`  (c) Ueberzahl-Fehler: ${ueberzahlFehlerEcht.length} -> ${cOk ? "OK" : "FEHLER"}`);
    if (!cOk) console.log(`        Beispiele: ${JSON.stringify(ueberzahlFehlerEcht.slice(0, 3))}`);
    if (!cOk) alleOk = false;

    // (d) Beschriftung. klsuffix gilt fuer ALLE Kampf-Disziplinen (S1 ist chassis-weit); das
    // Banner-"Ausschaltungen" nur dort, wo das Spiel ausschliesslich ueber Ausschaltungen
    // entschieden wird (TDM) -- Battlefield kann ueber das KP-Limit gewinnen und zeigt dann
    // "Kontrollpunkte", s. KONFIG-Kommentar.
    const dOk = endzustand.klsuffix === "Ausschaltungen"
      && (!KONFIG[disc].bannerAusschaltungen || endzustand.esieger.includes("Ausschaltungen"));
    console.log(`  (d) klsuffix="${endzustand.klsuffix}", esieger="${endzustand.esieger}" -> ${dOk ? "OK" : "FEHLER"}`);
    if (!dOk) alleOk = false;

    // (e) Endstand-Zahl == letzte Scoreline == Schluss-Tickerzeile -- nur wo beide dieselbe
    // Groesse zeigen (TDM). Battlefields KP-Sieg-Banner zeigt die KP-Zahlen, nicht die
    // Ausschaltungen aus #score (derselbe dokumentierte Nebenbefund wie bei (d)).
    const scoreZahlen = (endzustand.score.match(/\d+/g) || []).map(Number);
    let eOk = true;
    if (KONFIG[disc].bannerVsScore) {
      const siegerZahlen = (endzustand.esieger.match(/\d+/g) || []).map(Number);
      const letzteSiegZeile = [...z.feed].reverse().find((f) => /gewinnt|Unentschieden/.test(f.txt));
      const siegZeileZahlen = letzteSiegZeile ? (letzteSiegZeile.txt.match(/\d+/g) || []).map(Number) : [];
      eOk = scoreZahlen.length === 2 && siegerZahlen.slice(-2).join(":") === scoreZahlen.join(":")
        && (siegZeileZahlen.length === 0 || siegZeileZahlen.slice(-2).join(":") === scoreZahlen.join(":"));
      console.log(`  (e) Score="${endzustand.score}" Endstand="${endzustand.esieger}" Schlusszeile="${letzteSiegZeile?.txt || "(keine)"}" -> ${eOk ? "OK" : "FEHLER"}`);
    } else {
      console.log(`  (e) uebersprungen (Battlefield-KP-Banner zeigt Kontrollpunkte, nicht Ausschaltungen -- Plan Abschnitt 3.3)`);
    }
    if (!eOk) alleOk = false;

    // (f) Ticker-Dichte und Protokoll-Vollstaendigkeit
    const minuten = ticks / 60 / 60;
    const jeMin = z.feed.length / minuten;
    const fOk = jeMin <= TICKER_SCHRANKE_JE_MIN && z.prot.length === PROTOKOLL_VORHER[disc];
    console.log(`  (f) Ticker ${jeMin.toFixed(1)}/min (Schranke ${TICKER_SCHRANKE_JE_MIN}), Protokoll ${z.prot.length} (erwartet ${PROTOKOLL_VORHER[disc]}) -> ${fOk ? "OK" : "FEHLER"}`);
    if (!fOk) alleOk = false;

    // (g) keine Seitenfehler
    const gOk = fehler.length === 0;
    console.log(`  (g) Seitenfehler: ${gOk ? "keine" : fehler.join(" | ")} -> ${gOk ? "OK" : "FEHLER"}`);
    if (!gOk) alleOk = false;

    const out = path.join(ausgabeOrdner, `${disc}-endstand.png`);
    const frame = await seite.$("#p2 .frame");
    if (frame) await frame.screenshot({ path: out });
    console.log(`  Screenshots in ${ausgabeOrdner}/ (${disc}-ueberzahl.png falls Ungleichstand vorkam, ${disc}-endstand.png)`);

    await seite.close();
  }
} finally {
  if (browser) await browser.close();
  server.close();
}

console.log(`\n=== GESAMT: ${alleOk ? "ALLE PRUEFUNGEN BESTANDEN" : "MINDESTENS EINE PRUEFUNG FEHLGESCHLAGEN"} ===`);
process.exit(alleOk ? 0 : 1);
