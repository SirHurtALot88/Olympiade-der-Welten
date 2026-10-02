// SICHTPRUEFUNG fuer Paket 3 "Menue und Programm" (Fable-Ideen Buehne-Auftritt 30.09.,
// docs/design/fable-ideen-buehne-auftritt-30-09.md): W-F2 ("Das Menue des Spieltags",
// Wettessen) + E-F4 ("Jedes Paar hat ein Programm", Eiskunstlauf) -- beide Klasse A, reine
// Anzeige. Kein Teil der Abnahme-Sonden (die sind miss-alle-disziplinen.mjs/
// messe-arena-einfluss.mjs) -- nur Beleg, dass beide ohne Seitenfehler sichtbar werden.
//
// W-F2 ist per DOM-Text pruefbar (Feed/Protokoll + Wertungstabellen-Spaltenkopf aendern
// sich mit dem gezogenen Gericht). E-F4 ist reine Canvas-Zeichnung (wie actVon()/der
// Showcase-Act) -- dafuer liest dieses Skript zusaetzlich die Sonde
// window.__arena.eiskunstlaufProgrammProbe(name) (deterministisch, kein rr()) UND nimmt
// Screenshots im Moment, in dem ein Paar das Eis betritt, als visuellen Beleg.
//
// Aufruf: node scripts/verify-buehne-menue-programm-paket3-01-10.mjs [ausgabeOrdner]
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { existsSync, mkdirSync, createReadStream, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = path.join(WURZEL, "public");
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const MIME = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg", ".svg": "image/svg+xml", ".webp": "image/webp",
};
const AUSGABE = process.argv[2] || path.join(WURZEL, "tmp-ux-audit", "paket3-buehne-menue-programm-01-10");
mkdirSync(AUSGABE, { recursive: true });

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
let browser;
const ergebnis = { wettessen: {}, eiskunstlauf: {} };
try {
  browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});

  // ---- W-F2, TEIL A: variiert das Menue ueberhaupt mit der Saat? ------------------------
  // Die Demo-UI oeffnet ohne geladenen Spielstand IMMER mit der festen Saat 1337
  // (gebuchteSaatFuerAktuelleDisziplin()/normalisiereSaat(), s. dort) -- ein frischer
  // Seitenaufruf zeigt deshalb bei jedem #play-Klick dasselbe Gericht. Das ist kein Fehler
  // von W-F2, sondern eine Eigenheit der Demo-UI (ein echtes Spiel auf dem Server zieht
  // seine eigene Spieltags-Saat). Fuer den Variations-Nachweis liest dieses Skript deshalb
  // die reine Formel (wettessenMenuProbeFuerSaat(), s. dort) ueber dreissig verschiedene
  // Saaten -- kein bauBuehne()-Aufruf, kein Einfluss auf ein eventuell laufendes Spiel.
  {
    const seite = await browser.newPage();
    const fehler = [];
    seite.on("pageerror", (e) => fehler.push(String(e)));
    await seite.goto(SEITE, { waitUntil: "networkidle" });
    await seite.waitForFunction(() => window.__arena && window.__arena.setDisc, null, { timeout: 30000 });
    const saaten = Array.from({ length: 30 }, (_, i) => 1 + i * 104729);
    const proben = await seite.evaluate(
      (ss) => ss.map((s) => window.__arena.wettessenMenuProbeFuerSaat(s)),
      saaten,
    );
    ergebnis.wettessenFormelVariation = { fehler, gerichteGesehen: [...new Set(proben.map((p) => p.n))], saatenGezaehlt: saaten.length };
    await seite.close();
  }

  // ---- W-F2, TEIL B: ein echtes, gerendertes Spiel -- Sichtbeleg + DOM-Textbeleg --------
  for (let spiel = 0; spiel < 2; spiel++) {
    const seite = await browser.newPage({ viewport: { width: 1300, height: 900 } });
    const fehler = [];
    seite.on("pageerror", (e) => fehler.push(String(e)));
    seite.on("console", (m) => {
      if (m.type() === "error" && !/Failed to load resource.*404/.test(m.text())) fehler.push("console: " + m.text());
    });
    await seite.goto(SEITE, { waitUntil: "networkidle" });
    await seite.waitForFunction(() => window.__arena && window.__arena.setDisc, null, { timeout: 30000 });
    await seite.addStyleTag({ content: "body{background:#0B1018}" });
    await seite.evaluate(() => {
      document.documentElement.setAttribute("data-theme", "dark");
      document.querySelector(".oly-battle-arena")?.setAttribute("data-theme", "dark");
      document.querySelector(".oly-battle-arena")?.classList.add("im-spiel");
    });
    await seite.evaluate((d) => window.__arena.setDisc(d), "wettessen");
    await seite.click("#t2");
    await seite.click("#play");
    await seite.evaluate(() => window.__arena.sondenLauf(180));
    await (await seite.$("#cv")).screenshot({ path: path.join(AUSGABE, `wettessen-spiel${spiel}-tafel.png`) });
    const menu = await seite.evaluate(() => window.__arena.wettessenMenuProbe());
    const text = await seite.evaluate(() => {
      const prot = document.getElementById("protokoll");
      const feed = document.getElementById("feed");
      return ((prot ? prot.textContent : "") || "") + "\n" + ((feed ? feed.textContent : "") || "");
    });
    await seite.evaluate(() => window.__arena.sondenLauf(600));
    const wertungstext = await seite.evaluate(() => {
      const box = document.getElementById("wertungBox");
      return box ? box.textContent : "";
    });
    ergebnis.wettessen[`spiel${spiel}`] = {
      fehler,
      gericht: menu,
      einheitImFeed: menu ? text.includes(menu.einheit) : false,
      einheitInWertungstabelle: menu ? wertungstext.includes(menu.einheit) : false,
      feedAuszug: text.split("\n").filter((z) => z.trim()).slice(-15),
    };
    await seite.close();
  }

  // ---- E-F4: Sonde (deterministisch) + Screenshot beim Eis-Einlauf ---------------------
  for (let spiel = 0; spiel < 2; spiel++) {
    const seite = await browser.newPage({ viewport: { width: 1300, height: 900 } });
    const fehler = [];
    seite.on("pageerror", (e) => fehler.push(String(e)));
    seite.on("console", (m) => {
      if (m.type() === "error" && !/Failed to load resource.*404/.test(m.text())) fehler.push("console: " + m.text());
    });
    await seite.goto(SEITE, { waitUntil: "networkidle" });
    await seite.waitForFunction(() => window.__arena && window.__arena.setDisc, null, { timeout: 30000 });
    await seite.addStyleTag({ content: "body{background:#0B1018}" });
    await seite.evaluate(() => {
      document.documentElement.setAttribute("data-theme", "dark");
      document.querySelector(".oly-battle-arena")?.setAttribute("data-theme", "dark");
      document.querySelector(".oly-battle-arena")?.classList.add("im-spiel");
    });
    await seite.evaluate((d) => window.__arena.setDisc(d), "eiskunstlauf");
    await seite.click("#t2");
    await seite.click("#play");
    // Kurz nach dem Start: das ERSTE Paar sollte gerade das Eis betreten (Einblender läuft).
    await seite.evaluate(() => window.__arena.sondenLauf(2));
    await (await seite.$("#cv")).screenshot({ path: path.join(AUSGABE, `eiskunstlauf-spiel${spiel}-einlauf.png`) });
    await seite.evaluate(() => window.__arena.sondenLauf(40));
    await (await seite.$("#cv")).screenshot({ path: path.join(AUSGABE, `eiskunstlauf-spiel${spiel}-mitte.png`) });
    ergebnis.eiskunstlauf[`spiel${spiel}`] = { fehler };
    await seite.close();
  }

  // SONDE (deterministisch, kein rr()): dasselbe Team zweimal abgefragt muss denselben
  // Titel liefern -- Beleg fuer "stabil je Teilnehmer", nicht nur "irgendein Text". Namen
  // aus dem echten, fest einprogrammierten Demo-Kader (SQUAD, "Vigilante Wranglers", s.
  // battle-mode.engine.js) -- dieselben zehn Namen, die renderProbe/showcaseActProbe schon
  // verwenden koennen.
  {
    const seite = await browser.newPage();
    await seite.goto(SEITE, { waitUntil: "networkidle" });
    await seite.waitForFunction(() => window.__arena && window.__arena.setDisc, null, { timeout: 30000 });
    const kandidaten = ["Draco", "Lava Golem", "Krolach", "Johanna", "King Arlen Morgolor", "Gram", "Rhyx'Tal", "Xelara", "Jorund", "Inefinna", "Lulu"];
    const treffer = [];
    for (const name of kandidaten) {
      const p1 = await seite.evaluate((n) => window.__arena.eiskunstlaufProgrammProbe(n), name);
      const p2 = await seite.evaluate((n) => window.__arena.eiskunstlaufProgrammProbe(n), name);
      if (p1) treffer.push({ name, p1, stabil: JSON.stringify(p1) === JSON.stringify(p2) });
    }
    ergebnis.eiskunstlaufSonde = treffer;
    await seite.close();
  }
} finally {
  // OHNE DIESEN AUFRUF HAENGT DER PROZESS AUF DEM ERFOLGSPFAD EWIG (nachgemessen): ein
  // offener chromium.launch()-Handle haelt die Node-Eventloop am Leben, auch wenn jede
  // einzelne Seite laengst per seite.close() geschlossen ist. Auf dem FEHLERPFAD faellt das
  // nicht auf, weil process.exit(1) weiter unten das Problem ueberdeckt -- derselbe fehlende
  // Aufruf steckt auch in verify-buehne-startreihenfolge-paket1-01-10.mjs/
  // verify-buehne-etiketten-stimmen-paket2-01-10.mjs, dort aber bislang nie auf dem
  // Erfolgspfad beobachtet, weil beide Skripte bislang nie ohne mindestens einen
  // process.exit(1)-Treffer liefen.
  if (browser) await browser.close();
  server.close();
}

writeFileSync(path.join(AUSGABE, "ergebnis.json"), JSON.stringify(ergebnis, null, 2));
console.log(JSON.stringify(ergebnis, null, 2));

const alleFehler = [
  ...(ergebnis.wettessenFormelVariation?.fehler || []),
  ...Object.values(ergebnis.wettessen).flatMap((v) => v.fehler || []),
  ...Object.values(ergebnis.eiskunstlauf).flatMap((v) => v.fehler || []),
];
if (alleFehler.length) {
  console.error("SEITENFEHLER gefunden:", alleFehler);
  process.exit(1);
}
const ohneEinheitImFeed = Object.entries(ergebnis.wettessen).filter(([, v]) => v.gericht && !v.einheitImFeed);
if (ohneEinheitImFeed.length) {
  console.error("W-F2: GERICHT-EINHEIT NICHT IM FEED gefunden bei:", ohneEinheitImFeed.map(([k]) => k));
  process.exit(1);
}
if ((ergebnis.wettessenFormelVariation?.gerichteGesehen.length || 0) < 2) {
  console.error("W-F2: FORMEL VARIIERT NICHT ueber 30 Saaten:", ergebnis.wettessenFormelVariation);
  process.exit(1);
}
const sonde = ergebnis.eiskunstlaufSonde || [];
if (sonde.length < 5) {
  console.error("E-F4: ZU WENIGE SONDENTREFFER (Kadernamen stimmen nicht?):", sonde);
  process.exit(1);
}
const instabil = sonde.filter((t) => !t.stabil);
if (instabil.length) {
  console.error("E-F4: SONDE NICHT STABIL (zwei Aufrufe, unterschiedliches Ergebnis):", instabil);
  process.exit(1);
}
const titelVarianz = new Set(sonde.map((t) => t.p1.titel)).size;
if (titelVarianz < 2) {
  console.error("E-F4: ALLE SPIELER BEKOMMEN DENSELBEN TITEL -- keine Varianz:", sonde.map((t) => t.p1.titel));
  process.exit(1);
}
console.log("Seitenfehler: keine -- W-F2 (Gericht variiert, Einheit im Feed/Tabelle) und E-F4 (Sonde stabil + "
  + titelVarianz + " verschiedene Titel ueber " + sonde.length + " Kadermitglieder, Screenshots beim Eis-Einlauf) ohne Fehler.");
