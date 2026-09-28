// Sichtpruefung der Kamera-/Atmosphaere-/Countdown-Ueberarbeitung (Climbing-Audit-Fund,
// Broadcast-Optik Phase 5, 28.09., Klasse A): laesst Climbing mit mehreren Saaten laufen,
// schiesst frueh/mittig/spaet Screenshots (frueh und spaet sollen die entscheidenden Momente
// zeigen: Kletterer nahe am Wandfuss UND nahe am Top-out, wo vorher der Bildschnitt am
// oberen Rand zuschlug), dazu einen Vergleichs-Screenshot von Breaking auf derselben Buehne.
// Kein Teil der Abnahme-Sonden (das ist miss-alle-disziplinen.mjs) -- nur der visuelle Beleg
// fuer die PR-Beschreibung.
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { existsSync, mkdirSync } from "node:fs";
import { createServer } from "node:http";
import { createReadStream, statSync } from "node:fs";
import path from "node:path";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = path.join(WURZEL, "public");
const OUT_DIR = process.argv[2] || path.join(WURZEL, "tmp-ux-audit", "climbing-kamera-framing");
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
const SAATEN = [1337, 4242, 20260928];
try {
  browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});

  for (const saat of SAATEN) {
    const seite = await browser.newPage({ viewport: { width: 1300, height: 700 } });
    const fehler = [];
    seite.on("pageerror", (e) => fehler.push(String(e)));
    await seite.goto(SEITE, { waitUntil: "networkidle" });
    await seite.waitForFunction(() => window.__arena && window.__arena.setDisc, null, { timeout: 30000 });
    await seite.evaluate(() => { window.__arena.setDisc("climbing"); });
    await seite.click("#t2");
    await seite.click("#play");

    // FRUEH: kurz nach dem Start, alle noch nahe am Wandfuss (posFrac ~0) -- prueft, dass
    // die neue Felskulisse/das Crack-Scrollen ohne Fehler rendert und niemand seltsam
    // aussieht, bevor irgendjemand in die Naehe des oberen Randes kommt.
    await seite.waitForTimeout(900);
    await (await seite.$("#cv")).screenshot({ path: path.join(OUT_DIR, `saat${saat}-01-fruehphase.png`) });

    // MITTIG: die Kamera hat inzwischen gezoomt/geschwenkt -- Kontrolle, dass die Parallax-
    // Kulisse tatsaechlich langsamer scrollt als die Wand/die Kletterer selbst.
    await seite.waitForTimeout(3000);
    await (await seite.$("#cv")).screenshot({ path: path.join(OUT_DIR, `saat${saat}-02-mittelphase.png`) });

    // SPAET/NAHE TOP-OUT: der eigentliche Testfall aus dem Audit-Fund -- niemand darf hier
    // am oberen Bildrand abgeschnitten sein, der Countdown muss lesbar/prominent sein.
    // `BA().zeitlimit` liegt bei ~16 Sim-s * zeitFaktor climbing (4,38) ~ 70 reale Sekunden
    // Renndauer; sechs weitere Sekunden Wartezeit treffen zuverlaessig die Spaetphase, in der
    // die schnellsten Kletterer nahe am Top-out stehen, ohne auf ein internes Feld angewiesen
    // zu sein, das __arena nicht exponiert.
    await seite.waitForTimeout(6000);
    await (await seite.$("#cv")).screenshot({ path: path.join(OUT_DIR, `saat${saat}-03-naeheTopout.png`) });

    await seite.waitForFunction(() => document.getElementById("phase")?.textContent === "beendet", null, { timeout: 60000 }).catch(() => {});
    await seite.waitForTimeout(200);
    await (await seite.$("#cv")).screenshot({ path: path.join(OUT_DIR, `saat${saat}-04-endstand.png`) });

    if (fehler.length) console.error(`Climbing Saat ${saat} Seitenfehler:`, fehler.slice(0, 10));
    else console.log(`Climbing Saat ${saat}: keine Seitenfehler`);
    await seite.close();
  }

  // VERGLEICH: Breaking auf derselben Buehne, derselbe Viewport, fuer den Screenshot-
  // Vergleich in der PR-Beschreibung (Audit verglich beide direkt).
  {
    const seite = await browser.newPage({ viewport: { width: 1300, height: 700 } });
    const fehler = [];
    seite.on("pageerror", (e) => fehler.push(String(e)));
    await seite.goto(SEITE, { waitUntil: "networkidle" });
    await seite.waitForFunction(() => window.__arena && window.__arena.setDisc, null, { timeout: 30000 });
    await seite.evaluate(() => { window.__arena.setDisc("breaking"); });
    await seite.click("#t2");
    await seite.click("#play");
    await seite.waitForTimeout(1500);
    await (await seite.$("#cv")).screenshot({ path: path.join(OUT_DIR, `vergleich-breaking.png`) });
    if (fehler.length) console.error("Breaking Seitenfehler:", fehler.slice(0, 10));
    await seite.close();
  }

  console.log("\nScreenshots in " + OUT_DIR);
} finally {
  if (browser) await browser.close();
  server.close();
}
