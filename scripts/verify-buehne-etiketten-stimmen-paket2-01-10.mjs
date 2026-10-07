// SICHTPRUEFUNG fuer Paket 2 "Etiketten und Stimmen" (Fable-Ideen Buehne-Auftritt 30.09.,
// docs/design/fable-ideen-buehne-auftritt-30-09.md, Abschnitt 3): S-F2 (Bester Act je
// Kategorie) + S-F3 (Jury-Spruch mit Standbezug) -- beide ausschliesslich Showcase. Kein
// Teil der Abnahme-Sonden (die sind miss-alle-disziplinen.mjs/messe-arena-einfluss.mjs) --
// nur Beleg, dass beide Etiketten im Produktionsmodus (data-theme="dark" + .im-spiel,
// dasselbe Muster wie verify-buehne-startreihenfolge-paket1-01-10.mjs) ohne Seitenfehler
// im Ticker UND in der Wertungstabelle erscheinen.
//
// Aufruf: node scripts/verify-buehne-etiketten-stimmen-paket2-01-10.mjs [ausgabeOrdner]
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { existsSync, mkdirSync, createReadStream, statSync, writeFileSync } from "node:fs";
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
};
const AUSGABE = process.argv[2] || path.join(WURZEL, "tmp-ux-audit", "paket2-buehne-etiketten-stimmen-01-10");
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
const ergebnis = {};
try {
  browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
  // DREI SAATEN (Besatzungs-Kaderwechsel ueber #t2-Klicks hinweg laufen auf derselben
  // festen Demo-Formation -- die drei Spiele dienen hier nur dazu, dass ein Zufallstreffer
  // ("die Jury-Saetze haetten auch zufaellig gleich geklungen") nicht als Beleg durchgeht).
  for (let spiel = 0; spiel < 3; spiel++) {
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
    await sendungsrahmenAus(seite); // Sendungsrahmen-Paket 07.10.: Countdown/Finale-in-Echtzeit/Endstand-Nachlauf aus -- diese Sonde misst bis zum Endstand bzw. per sondenLauf(), s. scripts/lib/arena-anpfiff.mjs

    await seite.addStyleTag({ content: "body{background:#0B1018}" });
    await seite.evaluate(() => {
      document.documentElement.setAttribute("data-theme", "dark");
      document.querySelector(".oly-battle-arena")?.setAttribute("data-theme", "dark");
      document.querySelector(".oly-battle-arena")?.classList.add("im-spiel");
    });
    await seite.evaluate((d) => window.__arena.setDisc(d), "showcase");
    await seite.click("#t2");
    await seite.click("#play");

    // MITTE: mindestens ein paar Acts schon fertig -- hier sollten bereits einzelne
    // Jury-Saetze (S-F3) im Ticker/Protokoll stehen, Kategoriepreise (S-F2) noch nicht
    // (die stehen erst fest, wenn ALLE Acts fertig sind).
    await seite.evaluate(() => window.__arena.sondenLauf(900));
    await (await seite.$("#cv")).screenshot({ path: path.join(AUSGABE, `showcase-spiel${spiel}-mitte.png`) });
    const mitteText = await seite.evaluate(() => {
      const prot = document.getElementById("protokoll");
      const feed = document.getElementById("feed");
      return ((prot ? prot.textContent : "") || "") + "\n" + ((feed ? feed.textContent : "") || "");
    });

    // ENDE: alle Acts fertig -- Jury-Saetze fuer jeden Act, Kategoriepreise fuer die
    // Sieger, plus die "Etikett"-Spalte in der Wertungstabelle.
    await seite.evaluate(() => window.__arena.sondenLauf(3600));
    await (await seite.$("#cv")).screenshot({ path: path.join(AUSGABE, `showcase-spiel${spiel}-ende.png`) });
    const endeText = await seite.evaluate(() => {
      const prot = document.getElementById("protokoll");
      const feed = document.getElementById("feed");
      return ((prot ? prot.textContent : "") || "") + "\n" + ((feed ? feed.textContent : "") || "");
    });
    await (await seite.$("#wertungBox"))?.screenshot({ path: path.join(AUSGABE, `showcase-spiel${spiel}-wertung.png`) }).catch(() => {});
    const wertungstext = await seite.evaluate(() => {
      const box = document.getElementById("wertungBox");
      return box ? box.textContent : "";
    });

    // S-F3: mindestens ein Jury-Satz (in Anfuehrungszeichen gesetzt, s. showcaseJurySpruch())
    // muss schon zur Spielmitte im Protokoll/Ticker stehen.
    const juryVorhanden = /„.+"/u.test(mitteText) || /„.+“/u.test(mitteText);
    // S-F2: nach dem Ende mindestens eine "Bester <Kategorie>: <Name>"-Zeile im Ticker/
    // Protokoll UND mindestens ein Vorkommen von "🏆" in der Wertungstabelle.
    const etikettTickerVorhanden = /Bester (Kampfkunst|Schützenkunst|Zaubershow|Gesang|Kraftakt|Akrobatik):/u.test(endeText);
    const etikettTabelleVorhanden = wertungstext.includes("🏆");

    ergebnis[`spiel${spiel}`] = {
      fehler,
      juryVorhandenZurMitte: juryVorhanden,
      etikettTickerVorhandenAmEnde: etikettTickerVorhanden,
      etikettTabelleVorhandenAmEnde: etikettTabelleVorhanden,
      endeTextAuszug: endeText.split("\n").filter((z) => z.trim()).slice(-40),
    };
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
const ohneJury = Object.entries(ergebnis).filter(([, v]) => !v.juryVorhandenZurMitte);
if (ohneJury.length) {
  console.error("KEIN JURY-SPRUCH (S-F3) gefunden bei:", ohneJury.map(([k]) => k));
  process.exit(1);
}
const ohneEtikettTicker = Object.entries(ergebnis).filter(([, v]) => !v.etikettTickerVorhandenAmEnde);
if (ohneEtikettTicker.length) {
  console.error("KEIN KATEGORIEPREIS IM TICKER (S-F2) gefunden bei:", ohneEtikettTicker.map(([k]) => k));
  process.exit(1);
}
const ohneEtikettTabelle = Object.entries(ergebnis).filter(([, v]) => !v.etikettTabelleVorhandenAmEnde);
if (ohneEtikettTabelle.length) {
  console.error("KEIN KATEGORIEPREIS IN DER WERTUNGSTABELLE (S-F2) gefunden bei:", ohneEtikettTabelle.map(([k]) => k));
  process.exit(1);
}
console.log("Seitenfehler: keine -- Jury-Sprueche (S-F3) und Kategoriepreise (S-F2, Ticker + Wertungstabelle) in allen drei Spielen sichtbar.");
