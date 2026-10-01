// SICHTPRUEFUNG fuer Paket 1 "Startreihenfolge nach Ergebnis" (Fable-Ideen Buehne-Auftritt
// 30.09., docs/design/fable-ideen-buehne-auftritt-30-09.md, Abschnitt 1/2/3): E-F1
// (Eiskunstlauf, Kurzprogramm und Kuer) + S-F1 (Showcase, Casting und Show). Kein Teil der
// Abnahme-Sonden (die sind miss-alle-disziplinen.mjs/messe-arena-einfluss.mjs) -- nur Beleg,
// dass die neue Reihenfolge im Produktionsmodus (data-theme="dark" + .im-spiel, dasselbe
// Muster wie verify-paket1-regie-bild-01-10.mjs) ohne Seitenfehler sichtbar wirksam ist UND
// tatsaechlich vom alten "nach Eignung sortiert"-Verhalten abweicht.
//
// Aufruf: node scripts/verify-buehne-startreihenfolge-paket1-01-10.mjs [ausgabeOrdner]
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
const AUSGABE = process.argv[2] || path.join(WURZEL, "tmp-ux-audit", "paket1-buehne-startreihenfolge-01-10");
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

// "Waere es nach der ALTEN Regel (aufsteigend nach Eignung, Seiten verzahnt) gegangen, in
// welcher Reihenfolge waeren die Besuche gekommen?" -- aus denselben Rohdaten, die die Sonde
// liefert (Seite+Eignung je Besuch), damit sich ohne zweiten Build-Pfad vergleichen laesst,
// ob E-F1/S-F1 tatsaechlich etwas AM BILD aendern.
function alteReihenfolgeNamen(besuche) {
  const jeSeite = [0, 1].map((seite) =>
    besuche.filter((b) => b.seite === seite).slice().sort((a, b) => a.eig - b.eig));
  const alt = [];
  const maxLen = Math.max(jeSeite[0].length, jeSeite[1].length);
  for (let i = 0; i < maxLen; i++) {
    for (const seite of [0, 1]) {
      const b = jeSeite[seite][i];
      if (b) alt.push(b.namen.join("+"));
    }
  }
  return alt;
}

const server = await starteServer();
const SEITE = `http://127.0.0.1:${server.address().port}/mockups/battle-mode.html`;
let browser;
const ergebnis = {};
try {
  browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
  for (const disc of ["eiskunstlauf", "showcase"]) {
    const seite = await browser.newPage({ viewport: { width: 1300, height: 900 } });
    const fehler = [];
    seite.on("pageerror", (e) => fehler.push(String(e)));
    seite.on("console", (m) => {
      if (m.type() === "error" && !/Failed to load resource.*404/.test(m.text())) {
        fehler.push("console: " + m.text());
      }
    });
    await seite.goto(SEITE, { waitUntil: "networkidle" });
    await seite.waitForFunction(() => window.__arena && window.__arena.setDisc, null, { timeout: 30000 });

    // SCHRITT 1: die reine Datenprobe (kein laufendes Spiel noetig) -- drei Saaten, damit ein
    // Zufallstreffer ("die neue Reihenfolge entspricht zufaellig der alten") nicht als
    // "unveraendert" durchrutscht.
    const proben = await seite.evaluate((d) => {
      const saaten = [1337, 20260930, 777];
      return saaten.map((s) => ({ saat: s, besuche: window.__arena.buehneReihenfolge(d, s) }));
    }, disc);
    const vergleich = proben.map(({ saat, besuche }) => {
      const neu = besuche.map((b) => b.namen.join("+"));
      const alt = alteReihenfolgeNamen(besuche);
      // Jedes Paar/jeder Act erscheint bei E-F1/S-F1 ZWEIMAL in `besuche` (Kurzprogramm+Kuer
      // bzw. Casting+Show) -- "unveraendert" hiesse: Zahl der Besuche = Zahl der DISTINKTEN
      // Teilnehmer/Paare (ein einziger Besuch je Teilnehmer, wie vor Paket 1) UND Reihenfolge
      // = alte Eignungs-Reihenfolge. Beides zusammen ist der Beleg.
      const distinkt = new Set(neu).size;
      return {
        saat, besucheGesamt: besuche.length, distinkteTeilnehmerOderPaare: distinkt,
        zweiBesucheJeTeilnehmer: besuche.length > distinkt,
        reihenfolgeGeaendert: JSON.stringify(neu) !== JSON.stringify(alt),
        neu, alt,
      };
    });
    ergebnis[disc] = { fehler: [], proben: vergleich };

    // SCHRITT 2: ein echtes Spiel im Produktionsmodus, fuer den Sichtbeleg (Screenshots) und
    // den Seitenfehler-Check waehrend tatsaechlicher Enthuellung/Animation.
    await seite.addStyleTag({ content: "body{background:#0B1018}" });
    await seite.evaluate(() => {
      document.documentElement.setAttribute("data-theme", "dark");
      document.querySelector(".oly-battle-arena")?.setAttribute("data-theme", "dark");
      document.querySelector(".oly-battle-arena")?.classList.add("im-spiel");
    });
    await seite.evaluate((d) => window.__arena.setDisc(d), disc);
    await seite.click("#t2");
    await seite.click("#play");
    // Mitten im ERSTEN Block (Kurzprogramm/Casting) -- noch keine Kiss-&-Cry-Plakette.
    await seite.evaluate(() => window.__arena.sondenLauf(240));
    await (await seite.$("#cv")).screenshot({ path: path.join(AUSGABE, `${disc}-block1.png`) });
    // Mitten im SPIEL (fuer Eiskunstlauf: nach dem Kurzprogramm, Zwischenrang-Plakette
    // sollte im Kiss & Cry sichtbar sein; fuer Showcase: mitten in der Show).
    await seite.evaluate(() => window.__arena.sondenLauf(900));
    await (await seite.$("#cv")).screenshot({ path: path.join(AUSGABE, `${disc}-mitte.png`) });
    // BIS ZUM ENDE.
    await seite.evaluate(() => window.__arena.sondenLauf(3600));
    await (await seite.$("#cv")).screenshot({ path: path.join(AUSGABE, `${disc}-ende.png`) });
    ergebnis[disc].fehler = fehler;
    await seite.close();
  }
} finally {
  server.close();
}

writeFileSync(path.join(AUSGABE, "ergebnis.json"), JSON.stringify(ergebnis, null, 2));
console.log(JSON.stringify(ergebnis, null, 2));
const seitenfehler = Object.entries(ergebnis).filter(([, v]) => v.fehler.length);
if (seitenfehler.length) {
  console.error("SEITENFEHLER gefunden:", seitenfehler);
  process.exit(1);
}
const nichtGeaendert = Object.entries(ergebnis).filter(
  ([, v]) => v.proben.some((p) => !p.reihenfolgeGeaendert || !p.zweiBesucheJeTeilnehmer)
);
if (nichtGeaendert.length) {
  console.error("REIHENFOLGE NICHT GEAENDERT bei:", nichtGeaendert.map(([d]) => d));
  process.exit(1);
}
console.log("Seitenfehler: keine -- Reihenfolge bei beiden Disziplinen und allen Saaten vom alten Eignungs-Sortierverhalten abweichend.");
