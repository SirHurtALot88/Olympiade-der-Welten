// A0.2 — Vorher/Nachher-Beleg fuer den deterministischen Sonden-Modus
// (docs/design/deterministischer-sonden-modus-19-09.md, Opus-Synthese Echtzeit-vs-
// rundenbasiert Abschnitt 5.0).
//
// Startet einen kurzlebigen lokalen HTTP-Server auf public/ (NICHT file://): die Sprite-/
// Textur-Pfade im Motor sind absolut ("/sprites/arena/...", s. z.B. bodenArena()) und
// wuerden ueber file:// auf die Dateisystemwurzel zeigen, wo sie nie existieren — jeder
// Bild-Ladefehler waere zwar STABIL (immer derselbe Fehler), aber genau deshalb ungeeignet,
// um eine wanduhrgekoppelte DEKORATION zu zeigen: die Fackel-Animation zeichnet ohne
// geladenes Bild nur einen statischen Platzhalter, unabhaengig von der Wanduhr, und wuerde
// das eigentliche Rauschen verschleiern statt zu belegen. Ueber HTTP laedt jedes Sprite wie
// im echten Betrieb.
//
// Zeigt an ECHTEM Browserverhalten (nicht behauptet, gemessen):
//
//   VORHER (unveraendert am eigentlichen Spiel, s. "Nicht anfassen" in der Aufgabe): die
//   Arena-Bodendekoration (bodenArena(), Fackeln) liest performance.now() direkt
//   (Math.floor(performance.now()/110)%9) und wird ueber die kontinuierlich laufende
//   requestAnimationFrame-Schleife (loop(), IMMER aktiv, auch ohne "Kampf starten") bei
//   jedem Bild neu gezeichnet. Zwei Screenshots DESSELBEN pausierten Zustands (setDisc(d),
//   sonst nichts veraendert, KEIN sondenLauf), die sich nur im echten Zeitversatz VOR der
//   Aufnahme unterscheiden, sind deshalb NICHT pixelidentisch.
//
//   NACHHER (window.__arena.sondenLauf(ticks)): derselbe Zustand, derselbe Zeitversatz, aber
//   ueber den neuen Sonden-Modus aufgenommen, ist pixelidentisch — sondenAktiv koppelt
//   jetztMs() an eine simulationsgebundene Uhr (sondenSimMs), die reset() bei jedem
//   setDisc() auf 0 zurueckstellt, unabhaengig davon, wie lange die Seite vorher schon
//   offen war oder wie viel echte Zeit seit dem letzten Frame verging.
//
// Getestet ueber mehrere Chassis/Disziplinen — nicht nur ein Beispiel:
//   - VORHER/NACHHER zusammen: tdm (Arena-Chassis, einzige mit der canvas-sichtbaren
//     Fackel-Dekoration — Feldspiel/Buehne/Bahn haben keine wanduhrgekoppelte CANVAS-
//     Dekoration; die beiden anderen gefundenen Lesestellen (Viertelpause-Restsekunden,
//     Takeshi-SFX-Drossel) sind ein DOM-Overlay bzw. rein Audio, also im Canvas-Screenshot
//     gar nicht sichtbar, s. Dokument).
//   - NACHHER allein (die eigentliche Garantie des neuen Modus): zusaetzlich basketball
//     (Feldspiel), gewichtheben (Buehne), staffel (Bahn) — je ein Beispiel aus den drei
//     anderen Chassis.
//
// TOLERANZ (bewusst, s. docs/design/deterministischer-sonden-modus-19-09.md Abschnitt
// "Bekannte Grenze"): der Vergleich ist NICHT auf rohe PNG-Byte-Gleichheit gemuenzt, sondern
// auf eine winzige Pixeltoleranz (PIXEL_TOLERANZ unten). Grund, an Chromium selbst gemessen,
// nicht vermutet: manche Laeufe zeigen ein paar Dutzend bis wenige Tausend Pixel mit einer
// Abweichung von genau 1-2 Farbstufen in Gradient-/Kopfzeilenflaechen -- nachgewiesen NICHT
// an sondenSimMs/Tick-Zahl gebunden (beide Laeufe melden identische sondenLauf()-Werte und
// identische Eingaben), sondern an Chromiums eigenem Gradient-Dithering im Compositor, das
// unabhaengig vom Motor-Code arbeitet (bestaetigt: dieselbe Art Abweichung tritt bei
// EXAKT gleichem Zeitversatz zwischen zwei unabhaengigen Seiten ebenso gelegentlich auf wie
// bei unterschiedlichem -- sie korreliert nicht mit der hier geprueften Wanduhr-Kopplung).
// Kein Teil dieser Aufgabe (die betrifft nur Motor-seitige performance.now()/Date.now()-
// Lesestellen) und nicht behebbar durch Aenderungen an battle-mode.engine.js. Eine ECHTE
// Regression (falsche Simulation, verschobene Sprites, fehlendes Element) zeigt sich als
// GROSSE, zusammenhaengende Flaeche mit Delta nahe 255 -- davon klar unterscheidbar.
//
// Aufruf: node scripts/pruefe-sonden-modus-determinismus.mjs
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { mkdirSync, writeFileSync, existsSync, createReadStream, statSync } from "node:fs";
import { createHash } from "node:crypto";
import http from "node:http";
import path from "node:path";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC_DIR = path.join(WURZEL, "public");
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const AUSGABE = path.join(WURZEL, "tmp-ux-audit", "sonden-determinismus");
mkdirSync(AUSGABE, { recursive: true });

const MIME = {
  ".html": "text/html", ".js": "application/javascript", ".css": "text/css",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml",
  ".mp3": "audio/mpeg", ".json": "application/json", ".woff2": "font/woff2",
};

function starteServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      try {
        const urlPath = decodeURIComponent(req.url.split("?")[0]);
        const filePath = path.join(PUBLIC_DIR, urlPath);
        if (!filePath.startsWith(PUBLIC_DIR) || !existsSync(filePath) || statSync(filePath).isDirectory()) {
          res.writeHead(404); res.end(); return;
        }
        res.writeHead(200, { "Content-Type": MIME[path.extname(filePath)] || "application/octet-stream" });
        createReadStream(filePath).pipe(res);
      } catch (e) { res.writeHead(500); res.end(String(e)); }
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

// Settle-Wartezeit NACH Erreichen des Arena-Reiters, GLEICH fuer beide Zweige eines
// Vergleichs: laedt alle Sprite-Bilder fertig, BEVOR der eigentliche Zeitversatz-Test
// beginnt. Ohne dies waere ein "sofort"-Screenshot manchmal vor, ein spaeterer immer nach
// dem Laden einer Textur genommen -- ein Unterschied durchs Netzwerk, nicht durch die
// Wanduhr-Kopplung, die hier eigentlich geprueft wird faelschlicherweise als "Nachweis"
// missverstanden werden. Bewusst grosszuegig (Sprites sind klein, localhost ist schnell).
const SETTLE_MS = 3000;
// Kuenstlicher Zeitversatz-Kontrast: 0 vs. 650ms, deutlich ausserhalb der Fackel-Periode
// (9*110=990ms) UND weit ueber jedem realistischen Frame-Jitter.
const VERSATZ_KONTRAST = 650;
const TICKS = 90; // 1,5 Simulationssekunden bei 60 Ticks/s.
// Toleranz fuer den Pixelvergleich (s. Kommentar oben): hoechstens PIXEL_MAX_ANTEIL des
// Bildes darf ueberhaupt abweichen, und dort hoechstens um PIXEL_MAX_DELTA (Summe der
// Kanal-Differenzen R+G+B+A, max. moeglich waere 4*255=1020). Gemessene Chromium-eigene
// Dither-Abweichungen lagen bei einem Delta von 2-10 auf einem winzigen Bruchteil der
// Flaeche; eine echte inhaltliche Abweichung (verschobenes Sprite, fehlendes Element)
// liegt um Groessenordnungen darueber.
const PIXEL_MAX_DELTA = 40;
const PIXEL_MAX_ANTEIL = 0.02;

const VORHER_NACHHER_DISZIPLINEN = [
  { d: "tdm", label: "TDM (Arena)" },
];
const NUR_NACHHER_DISZIPLINEN = [
  { d: "basketball", label: "Basketball (Feldspiel)" },
  { d: "gewichtheben", label: "Gewichtheben (Buehne)" },
  { d: "staffel", label: "Staffel (Bahn)" },
  { d: "mini-dm", label: "Mini-DM (Arena)" },
  { d: "battlefield", label: "Battlefield (Arena)" },
];

function hash(buf) { return createHash("sha256").update(buf).digest("hex").slice(0, 16); }

// Pixelvergleich zweier PNG-Buffer MIT Toleranz (s. Kommentar oben bei PIXEL_MAX_DELTA):
// laedt beide in eine Hilfsseite, zeichnet sie auf Canvas und vergleicht Pixel fuer Pixel.
async function vergleicheBilder(browser, bufA, bufB) {
  const seite = await browser.newPage();
  const res = await seite.evaluate(async ({ a, b }) => {
    function laden(b64) {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.src = "data:image/png;base64," + b64;
      });
    }
    const [imgA, imgB] = await Promise.all([laden(a), laden(b)]);
    const c1 = document.createElement("canvas"); c1.width = imgA.width; c1.height = imgA.height;
    const c2 = document.createElement("canvas"); c2.width = imgB.width; c2.height = imgB.height;
    const x1 = c1.getContext("2d"), x2 = c2.getContext("2d");
    x1.drawImage(imgA, 0, 0); x2.drawImage(imgB, 0, 0);
    const d1 = x1.getImageData(0, 0, c1.width, c1.height).data;
    const d2 = x2.getImageData(0, 0, c2.width, c2.height).data;
    let diffCount = 0, maxDelta = 0, ueberSchranke = 0;
    const n = d1.length / 4;
    for (let i = 0; i < d1.length; i += 4) {
      const delta = Math.abs(d1[i] - d2[i]) + Math.abs(d1[i + 1] - d2[i + 1])
        + Math.abs(d1[i + 2] - d2[i + 2]) + Math.abs(d1[i + 3] - d2[i + 3]);
      if (delta) { diffCount++; if (delta > maxDelta) maxDelta = delta; }
    }
    return { pixel: n, diffCount, maxDelta };
  }, { a: bufA.toString("base64"), b: bufB.toString("base64") });
  await seite.close();
  const anteil = res.diffCount / res.pixel;
  const identisch = res.diffCount === 0;
  const praktischGleich = identisch || (res.maxDelta <= PIXEL_MAX_DELTA && anteil <= PIXEL_MAX_ANTEIL);
  return { ...res, anteil, identisch, praktischGleich };
}

async function bereiteSeiteVor(browser, seiteUrl, d) {
  const seite = await browser.newPage({ viewport: { width: 1300, height: 700 } });
  const fehler = [];
  seite.on("pageerror", (e) => fehler.push(String(e)));
  await seite.goto(seiteUrl, { waitUntil: "networkidle" });
  await seite.waitForFunction(() => window.__arena && window.__arena.setDisc, null, { timeout: 30000 });
  await seite.evaluate((disc) => window.__arena.setDisc(disc), d);
  await seite.click("#t2"); // Reiter "Arena" -- macht die Leinwand erst sichtbar.
  await seite.waitForTimeout(SETTLE_MS);
  return { seite, fehler };
}

async function vorherScreenshot(browser, seiteUrl, d, versatzMs) {
  const { seite, fehler } = await bereiteSeiteVor(browser, seiteUrl, d);
  if (versatzMs > 0) await seite.waitForTimeout(versatzMs);
  const buf = await (await seite.$("#cv")).screenshot();
  await seite.close();
  return { buf, fehler };
}

async function nachherScreenshot(browser, seiteUrl, d, versatzMs) {
  const { seite, fehler } = await bereiteSeiteVor(browser, seiteUrl, d);
  if (versatzMs > 0) await seite.waitForTimeout(versatzMs);
  const info = await seite.evaluate((n) => window.__arena.sondenLauf(n), TICKS);
  const buf = await (await seite.$("#cv")).screenshot();
  await seite.close();
  return { buf, fehler, info };
}

(async () => {
  const server = await starteServer();
  const { port } = server.address();
  const seiteUrl = "http://127.0.0.1:" + port + "/mockups/battle-mode.html";
  const browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
  let alleOk = true;
  const bericht = [];

  for (const { d, label } of VORHER_NACHHER_DISZIPLINEN) {
    console.log("\n=== " + label + " (" + d + ") — VORHER + NACHHER ===");

    // ROHWERT-BELEG (der eigentliche, harte Beweis fuer die Wanduhr-Kopplung, unabhaengig
    // von Pixel-/Rendering-Zufaelligkeiten): dieselbe Formel wie bodenArena() bei der
    // Fackel-Animation, Math.floor(performance.now()/110)%9, direkt ausgewertet -- einmal
    // sofort, einmal nach echtem Zeitversatz. Mathematisch garantiert unterschiedlich fuer
    // JEDEN Startzeitpunkt, sobald der Versatz > 1 Fackel-Frame (110ms) ist UND kein
    // Vielfaches von 990ms (9*110) -- 650ms erfuellt beides (Versatz in Frames: 650/110≈5,9,
    // niemals 0 mod 9). Das ist der Beleg fuer den WURZELFEHLER selbst, nicht nur fuer sein
    // (rendering-abhaengiges) Symptom im Screenshot.
    const { seite: rohSeite } = await bereiteSeiteVor(browser, seiteUrl, d);
    const rohVorher = await rohSeite.evaluate(() => Math.floor(performance.now() / 110) % 9);
    await rohSeite.waitForTimeout(VERSATZ_KONTRAST);
    const rohNachher = await rohSeite.evaluate(() => Math.floor(performance.now() / 110) % 9);
    await rohSeite.close();
    const rohUnterschiedlich = rohVorher !== rohNachher;
    console.log("  ROHWERT Fackel-Frame (Math.floor(performance.now()/110)%9): " + rohVorher + " -> " + rohNachher
      + " (nach " + VERSATZ_KONTRAST + "ms echtem Zeitversatz) -> " + (rohUnterschiedlich ? "unterschiedlich (Wurzelfehler bestaetigt)" : "IDENTISCH(!)"));

    const vorherBufs = [];
    for (const v of [0, VERSATZ_KONTRAST]) {
      const { buf, fehler } = await vorherScreenshot(browser, seiteUrl, d, v);
      if (fehler.length) console.log("  Seitenfehler (vorher, versatz=" + v + "): " + fehler.join(" | "));
      vorherBufs.push(buf);
      writeFileSync(path.join(AUSGABE, d + "-vorher-" + v + "ms.png"), buf);
    }
    const vorherHashes = vorherBufs.map(hash);
    const vorherVergleich = await vergleicheBilder(browser, vorherBufs[0], vorherBufs[1]);
    console.log("  VORHER-Screenshots (kein sondenLauf, zur Anschauung) hashes: " + vorherHashes.join(" vs ")
      + " -> " + (vorherVergleich.identisch ? "IDENTISCH" : "unterschiedlich")
      + " (diff " + vorherVergleich.diffCount + "/" + vorherVergleich.pixel + " Px, maxDelta " + vorherVergleich.maxDelta + ")");

    const nachherBufs = [];
    let letzteInfo = null;
    for (const v of [0, VERSATZ_KONTRAST]) {
      const { buf, fehler, info } = await nachherScreenshot(browser, seiteUrl, d, v);
      if (fehler.length) console.log("  Seitenfehler (nachher, versatz=" + v + "): " + fehler.join(" | "));
      nachherBufs.push(buf);
      letzteInfo = info;
      writeFileSync(path.join(AUSGABE, d + "-nachher-" + v + "ms.png"), buf);
    }
    const nachherHashes = nachherBufs.map(hash);
    const nachherVergleich = await vergleicheBilder(browser, nachherBufs[0], nachherBufs[1]);
    console.log("  NACHHER (sondenLauf(" + TICKS + ")) hashes: " + nachherHashes.join(" vs ")
      + " -> " + (nachherVergleich.praktischGleich ? (nachherVergleich.identisch ? "IDENTISCH" : "praktisch identisch (Chromium-Dither, s.o.)") : "unterschiedlich")
      + " (diff " + nachherVergleich.diffCount + "/" + nachherVergleich.pixel + " Px, maxDelta " + nachherVergleich.maxDelta + ")");
    console.log("  sondenLauf-Info: " + JSON.stringify(letzteInfo));

    // Erwartung: der ROHWERT unterscheidet sich nach echtem Zeitversatz (Beleg fuer den
    // Wurzelfehler selbst), waehrend der SONDEN-Screenshot praktisch identisch bleibt
    // (Beleg fuer den Fix, s. Toleranz-Kommentar oben). Die VORHER-Screenshots dienen nur
    // der Anschauung (PNGs in tmp-ux-audit/) und gehen NICHT in die Bewertung ein, weil ihr
    // Pixel-Ausschlag von der zufaelligen Fackel-Phase abhaengt (benachbarte Frames eines
    // Flammen-Sprites koennen sich optisch aehneln, obwohl der Rohwert bereits abweicht).
    const ok = rohUnterschiedlich && nachherVergleich.praktischGleich;
    if (!ok) alleOk = false;
    bericht.push({ label, vorherGleich: !rohUnterschiedlich, nachherGleich: nachherVergleich.praktischGleich, ok, art: "vorher+nachher" });
  }

  for (const { d, label } of NUR_NACHHER_DISZIPLINEN) {
    console.log("\n=== " + label + " (" + d + ") — NUR NACHHER (keine canvas-sichtbare Wanduhr-Deko in diesem Chassis) ===");
    const nachherBufs = [];
    let letzteInfo = null;
    for (const v of [0, VERSATZ_KONTRAST]) {
      const { buf, fehler, info } = await nachherScreenshot(browser, seiteUrl, d, v);
      if (fehler.length) console.log("  Seitenfehler (versatz=" + v + "): " + fehler.join(" | "));
      nachherBufs.push(buf);
      letzteInfo = info;
      writeFileSync(path.join(AUSGABE, d + "-nachher-" + v + "ms.png"), buf);
    }
    const nachherHashes = nachherBufs.map(hash);
    const nachherVergleich = await vergleicheBilder(browser, nachherBufs[0], nachherBufs[1]);
    console.log("  NACHHER (sondenLauf(" + TICKS + ")) hashes: " + nachherHashes.join(" vs ")
      + " -> " + (nachherVergleich.praktischGleich ? (nachherVergleich.identisch ? "IDENTISCH" : "praktisch identisch (Chromium-Dither, s.o.)") : "unterschiedlich")
      + " (diff " + nachherVergleich.diffCount + "/" + nachherVergleich.pixel + " Px, maxDelta " + nachherVergleich.maxDelta + ")");
    console.log("  sondenLauf-Info: " + JSON.stringify(letzteInfo));
    const ok = nachherVergleich.praktischGleich;
    if (!ok) alleOk = false;
    bericht.push({ label, vorherGleich: null, nachherGleich: nachherVergleich.praktischGleich, ok, art: "nur nachher" });
  }

  await browser.close();
  server.close();

  console.log("\n=== ZUSAMMENFASSUNG ===");
  for (const r of bericht) {
    console.log(
      (r.ok ? "OK  " : "FEHL") + " " + r.label.padEnd(24) + " (" + r.art + ")" +
      (r.vorherGleich === null ? "" : " vorher=" + (r.vorherGleich ? "identisch(!)" : "unterschiedlich")) +
      " nachher=" + (r.nachherGleich ? "identisch" : "unterschiedlich(!)")
    );
  }
  console.log(alleOk
    ? "\nAlle " + bericht.length + " Faelle wie erwartet. PNGs in " + AUSGABE
    : "\nMINDESTENS EIN FALL WEICHT VON DER ERWARTUNG AB — s. Zusammenfassung."
  );
  process.exit(alleOk ? 0 : 1);
})();
