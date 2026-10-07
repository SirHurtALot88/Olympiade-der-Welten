// VERIFIKATION TIME-TRIAL-BROADCAST-PAKET (07.10., docs/design/time-trial-broadcast-paket-
// plan-07-10.md Abschnitt 6, Schritt 4): spielt Time-Trial einmal volldeterministisch durch
// (window.__arena.sondenLauf(), feste Tick-Groesse statt echter Wanduhr) und prueft, dass
// F1 (Anzeige-Zustand-Leck) und T1 (kind-Falle beim Einbruch) zutreffen:
//
//   (a) kein Nachlauf (Sonde): nach dem ersten sichtbaren #endstand noch 600 Ticks (10 s
//       Sendezeit) weiterfahren -- danach stehen 0 neue Zeilen in #feed/#protokoll. Vor F1
//       waren das 1025 Zeilen in nur gut zwei Sekunden Nachlauf.
//   (b) kein Nachlauf (Echtzeit): derselbe Nachweis mit echter Wanduhr statt sondenLauf() --
//       Vorlauf per sondenLauf(), dann sondenAus() + #play, 3 echte Sekunden abwarten. Vor F1
//       kamen in 5 s echter Zeit 200 neue Zeilen und die Bildrate fiel auf 1,6 fps.
//   (c) jede Zwischenzeit genau einmal: jedes Paar "Name an ZZn" steht im Protokoll genau
//       einmal (24 Zeilen bei 12 Fahrern x 2 Zwischenzeiten), die Siegerzeile genau einmal.
//   (d) Ticker bleibt unter 30 Zeilen je Minute Sendezeit (T1), alle 24 Zwischenzeiten und
//       alle 12 "im Ziel" stehen im sichtbaren Ticker, Protokoll-Zeilenzahl = 83
//       (Standardkader, unveraendert durch F1/T1).
//   (e) Anzeige-Zustand nach dem Alternativ-Rechner unveraendert: #esieger-Text ist nach dem
//       Nachlauf aus (a) identisch zu dem direkt beim Endstand.
//   (f) keine `pageerror`
//   (g) Waechter fuer F1, STATISCH AM QUELLTEXT (kein Browser-Hook -- ein frueherer Entwurf
//       rief window.__arena.bauSpurtQuelle() auf, das es in der Engine nicht gibt; die
//       Pruefung sprang deshalb jedesmal stillschweigend leer durch und "ALLE PRUEFUNGEN
//       BESTANDEN" behauptete etwas, das nie gelaufen war -- Opus-Review 07.10. am ersten
//       Branch-Stand): der Funktionskoerper von bauSpurt() wird aus der Engine-Quelldatei
//       per Klammerzaehlung extrahiert, lokal deklarierte Namen (const/let/var, Funktions-
//       parameter) werden ausgenommen, Objektfeld-Zuweisungen (`u.feld=`) ebenfalls. Jedes
//       verbleibende Ziel, das weder in der ANZEIGE-Liste (bahnAnzeigeSichern()) noch im
//       Rennzustand steht, ist ein vergessenes Global -- Fehler statt stillem Leck beim
//       naechsten Fund.
//
// EINE EINZIGE evaluate()-SCHLEIFE fuer den Hauptlauf (Muster aus verify-breaking-broadcast-
// paket-07-10.mjs): viele kleine Playwright-Rundreisen sind unnoetig teuer und bei Breaking
// sogar nachweislich kaputt (docs/design/breaking-performance-einbruch-befund-01-10.md).
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { existsSync, mkdirSync, createReadStream, readFileSync, statSync } from "node:fs";
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

const ausgabeOrdner = path.join(WURZEL, "tmp-ux-audit", "time-trial-broadcast-paket-07-10");
mkdirSync(ausgabeOrdner, { recursive: true });
const server = await starteServer();
const port = server.address().port;
const SEITE = `http://127.0.0.1:${port}/mockups/battle-mode.html`;

const TICKER_SCHRANKE_JE_MIN = 30;
const PROTOKOLL_ERWARTET = 83;
const NACHLAUF_TICKS = 600; // 10 s Sendezeit, Plan Abschnitt 6 Schritt 4 (a)
const MAX_TICKS = 60 * 60 * 10;

// Die ANZEIGE-Liste aus bahnAnzeigeSichern() (engine.js), Kopie fuer den Waechter (g) --
// bewusst dieselbe Reihenfolge wie im Plan Abschnitt 6 Schritt 1, damit ein Diff zwischen
// den beiden Listen sofort auffaellt.
const ANZEIGE_GLOBALS = [
  "fortschrittVerlauf", "letzterBuehneBahnGrossT", "bahnFallenTypen", "bahnKursName",
  "bahnKursChaos", "bahnGedraengeGemeldet", "bahnKoennenGemeldet", "bahnEndeGemeldet",
  "bahnFuehrenderId", "bahnFuehrenderSeit", "staffelFuehrendeSeite", "bahnHotSeatId",
  "bahnZzGemeldet", "ttAmpelGemeldet", "ttRegieSeit", "bahnBauchbindeIdx",
  "bahnBauchbindeNaechste", "bahnFalleGemeldet", "bahnFalleAnzeige", "staffelAktivVorher",
  "staffelWechselAnzeige", "staffelVerlauf", "staffelBeinMarken", "staffelAnkerGezeigt",
  "staffelBeinDuellGemeldet", "spurtStationBest", "spurtFotofinishGezeigt",
  "spurtStationStats", "cam", "camR", "bahnWahl", "bahnFokus", "bahnFokusAuto", "ttPanelSig",
  "routeCache",
];
const RENNZUSTAND_GLOBALS = ["seed", "rennT", "done", "LAEUFER", "rennFertig", "floats"];

// (g) WAECHTER FUER F1, STATISCH AM QUELLTEXT -- kein Browser-Hook (s. Kopfkommentar):
// bauSpurt()s Funktionskoerper wird per Klammerzaehlung aus der Engine-Quelldatei
// geschnitten, Kommentare werden entfernt (ein erster Entwurf liess sie stehen und meldete
// "Geber" als Fund, weil ein FLIESSTEXT-Kommentar zufaellig "Geber = Bein davor" enthielt),
// lokale Deklarationen (const/let/var -- AUCH mehrere kommagetrennt wie "const d=bahnDisc,
// art=BA(), n=art.jeSeite", AUCH ohne Initialisierer), Arrow-Function-Parameter ("p=>...",
// derselbe erste Entwurf verwechselte das mit einer Zuweisung "p=") und Objektfeld-
// Zuweisungen ("u.feld=") fallen raus. Was danach als Ziel einer Zuweisung uebrig bleibt,
// MUSS entweder in der ANZEIGE-Liste oder im Rennzustand stehen -- sonst ist es ein Global,
// das bauSpurt() zuruecksetzt, ohne dass F1 es sichert.
function extrahiereFunktionskoerper(quelle, signatur) {
  const start = quelle.indexOf(signatur);
  if (start < 0) return null;
  const klammerStart = quelle.indexOf("{", start);
  let tiefe = 0, i = klammerStart;
  for (; i < quelle.length; i++) {
    if (quelle[i] === "{") tiefe++;
    else if (quelle[i] === "}") { tiefe--; if (tiefe === 0) break; }
  }
  return quelle.slice(klammerStart + 1, i);
}
function entferneKommentare(koerper) {
  // Genuegt fuer diese eine Funktion (keine Strings mit "//" oder "/*" im Koerper): erst
  // Blockkommentare, dann Zeilenkommentare -- je ein Durchlauf, keine Verschachtelung noetig.
  return koerper.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, "");
}
function sammleTopLevelNamen(anweisung) {
  // Zerlegt eine const/let/var-Anweisung (OHNE das Schluesselwort selbst) an Kommas auf
  // oberster Klammerebene -- "d=bahnDisc, art=BA(), n=art.jeSeite" -> drei Teile -- und nimmt
  // von jedem Teil nur den Namen vor einem "=" oder Ende (Destrukturierung "[a,b]"/"{a,b}"
  // wird uebersprungen, bauSpurt() nutzt keine).
  const namen = [];
  let tiefe = 0, start = 0;
  const teile = [];
  for (let i = 0; i <= anweisung.length; i++) {
    const c = anweisung[i];
    if (c && "([{".includes(c)) tiefe++;
    else if (c && ")]}".includes(c)) tiefe--;
    if (tiefe === 0 && (c === "," || i === anweisung.length)) {
      teile.push(anweisung.slice(start, i));
      start = i + 1;
    }
  }
  for (const teil of teile) {
    const m = teil.match(/^\s*([a-zA-Z_]\w*)/);
    if (m) namen.push(m[1]);
  }
  return namen;
}
function findeUnbekannteModulZuweisungen(koerperMitKommentaren, bekannt) {
  const koerper = entferneKommentare(koerperMitKommentaren);
  const lokal = new Set(["saat"]);
  const deklRe = /\b(?:const|let|var)\s+/g;
  let m;
  while ((m = deklRe.exec(koerper))) {
    let i = m.index + m[0].length, tiefe = 0;
    for (; i < koerper.length; i++) {
      const c = koerper[i];
      if ("([{".includes(c)) tiefe++;
      else if (")]}".includes(c)) { if (tiefe === 0) break; tiefe--; }
      else if (c === ";" && tiefe === 0) break;
    }
    for (const n of sammleTopLevelNamen(koerper.slice(m.index + m[0].length, i))) lokal.add(n);
  }
  // Arrow-Function-Parameter ("p=>...", auch "(p)=>" -- der Klammerfall deklariert ueber
  // die obige const/let-Suche ohnehin nichts, hier geht es um den NACKTEN Parameter ohne
  // Klammern) zaehlen ebenfalls als lokal, sonst liest die Zuweisungs-Suche "p=" aus "p=>".
  for (const m2 of koerper.matchAll(/\b([a-zA-Z_]\w*)\s*=>/g)) lokal.add(m2[1]);
  const ziele = new Set();
  // Gruppe 1 schliesst ein vorangehendes "." (Objektfeld) und Vergleichsoperator-Zeichen
  // (!,<,>,=) aus -- damit faellt "u.feld=" raus, "===""!=""<=""" ebenfalls, waehrend eine
  // einfache Zuweisung "name=wert" (auch am Zeilenanfang) erhalten bleibt. Das Lookahead
  // schliesst sowohl "==" als auch "=>" aus (Pfeilfunktion, s.o. -- ohne diesen zweiten
  // Ausschluss waere die lokal-Liste oben die einzige Verteidigung).
  for (const m3 of koerper.matchAll(/(^|[^.\w!<>=])\b([a-zA-Z_]\w*)\s*=(?![=>])/g)) ziele.add(m3[2]);
  return [...ziele].filter((n) => !lokal.has(n) && !bekannt.has(n));
}

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
  await seite.evaluate(() => window.__arena.setDisc("time-trial"));
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

  // EINE EINZIGE evaluate()-Rundreise bis zum Endstand, dann NACHLAUF_TICKS weiter (a).
  // ZAEHLUNG DIREKT UEBER DEN DOM, nicht ueber window.__tickerZaehler: MutationObserver-
  // Callbacks sind Microtasks und feuern erst, wenn der aktuelle Call-Stack abgearbeitet ist
  // -- innerhalb EINER synchronen evaluate()-Schleife bliebe der beobachtete Zaehler die
  // ganze Zeit auf 0, obwohl #feed/#protokoll laengst neue Kinder haben (feed() haengt sie
  // synchron an). Ein erster Entwurf dieser Sonde maß deshalb faelschlich "0 -> 0" und haette
  // jede Regression stillschweigend als "OK" durchgewunken.
  const ergebnis = await seite.evaluate(({ maxTicks, nachlaufTicks }) => {
    const SCHRITT = 60;
    const zaehleZeilen = (id) => {
      const box = document.getElementById(id);
      if (!box) return 0;
      return [...box.children].filter((n) => n.querySelector && n.querySelector(".tk") && !n.classList.contains("tkmehr")).length;
    };
    let ticks = 0;
    let fertig = false;
    while (ticks < maxTicks && !fertig) {
      window.__arena.sondenLauf(SCHRITT);
      ticks += SCHRITT;
      fertig = !document.getElementById("endstand").hidden;
    }
    const beimEndstand = {
      feed: zaehleZeilen("feed"),
      prot: zaehleZeilen("protokoll"),
      esieger: document.getElementById("esieger")?.textContent?.trim() || "",
    };
    // (a) Nachlauf in der Sonde: 600 weitere Ticks, nichts darf sich mehr aendern.
    window.__arena.sondenLauf(nachlaufTicks);
    const nachNachlauf = {
      feed: zaehleZeilen("feed"),
      prot: zaehleZeilen("protokoll"),
      esieger: document.getElementById("esieger")?.textContent?.trim() || "",
    };
    return { ticks, fertig, beimEndstand, nachNachlauf };
  }, { maxTicks: MAX_TICKS, nachlaufTicks: NACHLAUF_TICKS });

  const { ticks, fertig, beimEndstand, nachNachlauf } = ergebnis;

  if (!fertig) {
    console.log(`FEHLER: Rennen wurde nach ${ticks} Ticks nicht "beendet" -- Abbruch.`);
    alleOk = false;
  }

  const z = await seite.evaluate(() => ({
    feed: window.__tickerZaehler.feed,
    prot: window.__tickerZaehler.prot,
  }));

  // (a) kein Nachlauf, deterministisch
  const aOk = nachNachlauf.feed === beimEndstand.feed && nachNachlauf.prot === beimEndstand.prot;
  console.log(`(a) Sonden-Nachlauf (${NACHLAUF_TICKS} Ticks): Feed ${beimEndstand.feed}->${nachNachlauf.feed}, Protokoll ${beimEndstand.prot}->${nachNachlauf.prot} -> ${aOk ? "OK" : "FEHLER"}`);
  if (!aOk) alleOk = false;

  // (e) Anzeige-Zustand unveraendert: esieger-Text stabil ueber den Nachlauf
  const eOk = nachNachlauf.esieger === beimEndstand.esieger && beimEndstand.esieger.length > 0;
  console.log(`(e) esieger stabil: "${beimEndstand.esieger}" -> "${nachNachlauf.esieger}" -> ${eOk ? "OK" : "FEHLER"}`);
  if (!eOk) alleOk = false;

  // (b) kein Nachlauf, Echtzeit: frisches Rennen, Vorlauf per sondenLauf(), dann echte Wanduhr.
  await seite.evaluate(() => window.__arena.setDisc("time-trial"));
  await seite.click("#t2").catch(() => {});
  await seite.evaluate(() => { const e = document.getElementById("einlauf"); if (e) e.hidden = true; });
  await seite.evaluate(() => {
    window.__tickerZaehler = { feed: [], prot: [] };
    const zeile = (n) => ({ txt: n.textContent, big: !!n.querySelector(".big") });
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
  await seite.evaluate(() => window.__arena.sondenLauf(6600)); // kurz vor Zieleinlauf
  const vorEchtzeit = await seite.evaluate(() => window.__tickerZaehler.feed.length);
  await seite.evaluate(() => window.__arena.sondenAus());
  await seite.click("#play").catch(() => {});
  await seite.waitForFunction(() => !document.getElementById("endstand").hidden, null, { timeout: 15000 }).catch(() => {});
  const beiEchtEndstand = await seite.evaluate(() => window.__tickerZaehler.feed.length);
  const rafVorher = await seite.evaluate(() => new Promise((resolve) => {
    let n = 0;
    const start = performance.now();
    const tick = () => { n++; if (performance.now() - start < 1000) requestAnimationFrame(tick); else resolve(n); };
    requestAnimationFrame(tick);
  }));
  await seite.waitForTimeout(2000);
  const nachEchtzeit = await seite.evaluate(() => window.__tickerZaehler.feed.length);
  const rafNachher = await seite.evaluate(() => new Promise((resolve) => {
    let n = 0;
    const start = performance.now();
    const tick = () => { n++; if (performance.now() - start < 1000) requestAnimationFrame(tick); else resolve(n); };
    requestAnimationFrame(tick);
  }));
  const bOk = beiEchtEndstand === nachEchtzeit && rafNachher >= 10;
  console.log(`(b) Echtzeit-Nachlauf 2s: Feed ${beiEchtEndstand}->${nachEchtzeit}, fps vorher/nachher ${rafVorher}/${rafNachher} (Vorlauf hatte schon ${vorEchtzeit} Zeilen) -> ${bOk ? "OK" : "FEHLER"}`);
  if (!bOk) alleOk = false;

  // (c) jede Zwischenzeit genau einmal, Siegerzeile genau einmal (aus dem ersten, deterministischen Lauf)
  const zzZeilen = z.prot.filter((p) => / an ZZ[12]: /.test(p.txt));
  const zzNamen = zzZeilen.map((p) => p.txt.replace(/\s*\d{1,2}:\d{2}(:\d{2})?\s*/, "").trim());
  const dupZz = zzNamen.filter((t, i) => zzNamen.indexOf(t) !== i);
  const siegerZeilen = z.prot.filter((p) => /gewinnt|Rennen beendet/.test(p.txt));
  const cOk = zzZeilen.length === 24 && dupZz.length === 0 && siegerZeilen.length === 1;
  console.log(`(c) Zwischenzeiten im Protokoll: ${zzZeilen.length} (erwartet 24), Duplikate: ${dupZz.length}, Siegerzeilen: ${siegerZeilen.length} (erwartet 1) -> ${cOk ? "OK" : "FEHLER"}`);
  if (!cOk) alleOk = false;

  // (d) Ticker-Dichte und Zusammensetzung
  const minuten = ticks / 60 / 60;
  const jeMin = z.feed.length / minuten;
  const zzImTicker = z.feed.filter((p) => / an ZZ[12]: /.test(p.txt)).length;
  const zielImTicker = z.feed.filter((p) => /im Ziel/.test(p.txt)).length;
  const dOk = jeMin <= TICKER_SCHRANKE_JE_MIN && z.prot.length === PROTOKOLL_ERWARTET
    && zzImTicker === 24 && zielImTicker === 12;
  console.log(`(d) Ticker ${jeMin.toFixed(1)}/min (Schranke ${TICKER_SCHRANKE_JE_MIN}), Protokoll ${z.prot.length} (erwartet ${PROTOKOLL_ERWARTET}), ZZ im Ticker ${zzImTicker}/24, "im Ziel" im Ticker ${zielImTicker}/12 -> ${dOk ? "OK" : "FEHLER"}`);
  if (!dOk) alleOk = false;

  // (f) keine Seitenfehler
  const fOk = fehler.length === 0;
  console.log(`(f) Seitenfehler: ${fOk ? "keine" : fehler.join(" | ")} -> ${fOk ? "OK" : "FEHLER"}`);
  if (!fOk) alleOk = false;

  // (g) Waechter: bauSpurt() direkt aus der Engine-Quelldatei lesen (kein Browser-Hook noetig).
  const engineQuelle = readFileSync(path.join(PUBLIC, "mockups", "battle-mode.engine.js"), "utf8");
  const bauSpurtKoerper = extrahiereFunktionskoerper(engineQuelle, "function bauSpurt(saat){");
  let gOk;
  if (!bauSpurtKoerper) {
    gOk = false;
    console.log(`(g) FEHLER: bauSpurt() nicht im Quelltext gefunden (Signatur geaendert?) -> FEHLER`);
  } else {
    const bekannt = new Set([...ANZEIGE_GLOBALS, ...RENNZUSTAND_GLOBALS]);
    const unbekannt = findeUnbekannteModulZuweisungen(bauSpurtKoerper, bekannt);
    gOk = unbekannt.length === 0;
    console.log(`(g) Waechter (Quelltext-Scan bauSpurt()): ${unbekannt.length ? "unbekannte Zuweisungen: " + unbekannt.join(", ") : "keine unbekannten Modul-Zuweisungen gefunden"} -> ${gOk ? "OK" : "FEHLER"}`);
  }
  if (!gOk) alleOk = false;

  const out = path.join(ausgabeOrdner, "time-trial-endstand.png");
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
