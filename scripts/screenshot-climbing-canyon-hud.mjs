// SCREENSHOTS CANYON LIVE (18.11., docs/design/climbing-canyon-live-18-11.md): HUD-Profil (Kopfleiste mit Phase,
// Dock mit Seilschaft-Kaesten, Spielerkarte, Verlauf, Einblender) und die Kamera-Modi Totale und Folgen, im
// Live-Format (Motor-Vorgabe, kein Schalter gesetzt), echter Kader (erste Paarung der Kaderfamilie, 6 gegen 6).
//
// Aufruf (Aufnahmen nur unter der gemeinsamen Sperre, s. CLAUDE.md):
//   flock /tmp/oly-aufnahme.lock node scripts/screenshot-climbing-canyon-hud.mjs [ordner] [--saat=1337] [--breiten=1920,2560]
//
// Geraetefaktor 1 (Bildpixel = CSS-Pixel). Aufgenommen wird `.arenaHaupt` (Kopfleiste, Arenaraum, Dock), in der
// Einbettung des Spiels (`im-spiel`, dunkles Thema), damit die Arena die Fensterbreite nutzt wie im Spiel. Die Szenen
// sind nicht gestellt: das Skript spult die Wiedergabe der Saat (sondenLauf, derselbe Takt wie das Spiel) an die
// Zeitpunkte der ersten Rangelei/Hilfe/Glocke aus dem Ereignisprotokoll und schaltet nur die Kamera um.
// Mit --probe gibt es zusaetzlich je Szene die Lesesonde window.__arena.canyonHudProbe() aus (gezeigt gegen gebucht).
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { existsSync, mkdirSync, createReadStream, statSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { sendungsrahmenAus } from "./lib/arena-anpfiff.mjs";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = path.join(WURZEL, "public");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".webp": "image/webp", ".woff2": "font/woff2", ".ttf": "font/ttf" };
const args = process.argv.slice(2);
const ordner = args.find((a) => !a.startsWith("--")) || path.join(WURZEL, "docs", "design", "climbing-canyon-live-18-11");
const SAAT = Number(args.find((a) => a.startsWith("--saat="))?.split("=")[1] || 1337);
const BREITEN = (args.find((a) => a.startsWith("--breiten="))?.split("=")[1] || "1920,2560").split(",").map(Number);
const PROBE = args.includes("--probe");
mkdirSync(ordner, { recursive: true });
const v0 = JSON.parse(readFileSync(path.join(WURZEL, "data/generated/kaderfamilie-live-save.json"), "utf8")).varianten[0];

const server = await new Promise((resolve) => {
  const s = createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    let p = path.join(PUBLIC, decodeURIComponent(url.pathname));
    if (!p.startsWith(PUBLIC)) { res.writeHead(403); res.end(); return; }
    try {
      if (statSync(p).isDirectory()) p = path.join(p, "index.html");
      res.writeHead(200, { "Content-Type": MIME[path.extname(p)] || "application/octet-stream" });
      createReadStream(p).pipe(res);
    } catch { res.writeHead(404); res.end(); }
  });
  s.listen(0, "127.0.0.1", () => resolve(s));
});

let browser;
const fehler = [];
try {
  const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
  browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
  for (const breite of BREITEN) {
    const hoehe = Math.round((breite * 9) / 16);
    const seite = await browser.newPage({ viewport: { width: breite, height: hoehe }, deviceScaleFactor: 1 });
    seite.on("pageerror", (e) => fehler.push(`${breite}: ${String(e)}`));
    await seite.addInitScript(() => { window.__olyArenaKader = { seedByDisciplineId: {} }; });
    await seite.goto(`http://127.0.0.1:${server.address().port}/mockups/battle-mode.html`, { waitUntil: "networkidle" });
    await seite.waitForFunction(() => window.__arena && window.__arena.setDisc, null, { timeout: 60000 });
    const zeiten = await seite.evaluate(({ heim, gast, saat }) => {
      const A = window.__arena;
      A.endstandNachlauf(false); A.anpfiffCountdown(false);
      A.kaderSetzen({ heim, gast });
      A.bahnPodAnzeigen("climbing", null);
      window.__olyArenaKader.seedByDisciplineId.climbing = saat;
      return A.canyonEreignisZeiten(saat);
    }, { heim: v0.heim.slice(0, 6), gast: v0.gast.slice(0, 6), saat: SAAT });
    // Einbettung wie im Spiel (FoundationBattleArenaHost.tsx): dunkles Thema, `im-spiel` (ohne die 1300-px-Grenze des
    // Standalone-Entwurfs) und `im-spieltag` (Zuschau-Ansicht) -- so fuellt die Arena 1920 bzw. 2560 Pixel wie im Spiel.
    await seite.evaluate(() => {
      const w = document.querySelector(".oly-battle-arena");
      if (w) { w.setAttribute("data-theme", "dark"); w.classList.add("im-spiel", "im-spieltag"); }
    });
    await seite.click("#t2");
    await seite.evaluate(() => { window.__arena.setDisc("climbing"); });
    await sendungsrahmenAus(seite, { countdown: true, finale: true, nachlauf: true, figuren: true });
    await seite.waitForTimeout(1500);
    await seite.click("#play");
    await seite.waitForTimeout(300);
    await seite.click("#play");
    const dz = await seite.evaluate(() => window.__arena.canyonZeitDehnung());
    let simBisher = 0;
    const spule = async (bis) => {
      const ziel = Math.max(simBisher, bis);
      await seite.evaluate((ticks) => window.__arena.sondenLauf(ticks), Math.max(0, Math.round((ziel - simBisher) * 60 * dz)));
      simBisher = ziel;
    };
    const setze = async (n) => { for (let i = 0; i < n; i++) await seite.evaluate(() => window.__arena.sondenLauf(4)); simBisher += (n * 4) / 60 / dz; };
    const aufnahme = async (name) => {
      await seite.waitForTimeout(350);
      const ziel = (await seite.$(".arenaHaupt")) || (await seite.$(".arenaraum"));
      await ziel.scrollIntoViewIfNeeded();
      const datei = path.join(ordner, `${name}-${breite}.png`);
      await ziel.screenshot({ path: datei });
      const probe = PROBE ? await seite.evaluate(() => window.__arena.canyonHudProbe()) : null;
      console.log(`Screenshot ${datei} (Sim ${simBisher.toFixed(1)} s)` + (probe ? "\n" + JSON.stringify({ aktiv: probe.aktiv, kamera: probe.kamera, gezeigt: { stand: probe.gezeigt.stand, uhr: probe.gezeigt.uhr, phase: probe.gezeigt.phase, oben: probe.gezeigt.oben, seilschaften: probe.gezeigt.seilschaften }, gebucht: { stand: probe.gebucht.stand, clock: probe.gebucht.clock } }) : ""));
    };
    // 1) Totale: die ganze Wand mitten im Rennen (erste Rangelei am Band)
    await seite.evaluate(() => window.__arena.canyonKamera("totale"));
    await spule(Math.max(1, (zeiten?.rangel ?? 6) - 0.2));
    await setze(14);
    await aufnahme("01-totale");
    // 2) Folgen: Klick auf die Dock-Leiste eines Kletterers (oeffnet die Spielerkarte, Kamera folgt)
    await spule(Math.max(simBisher, (zeiten?.zieht ?? 12) - 0.2));
    const id = await seite.evaluate(() => {
      const p = window.__arena.canyonHudProbe();
      const offen = p.gebucht.spieler.filter((s) => !/:/.test(s.kern) && s.ort !== "Oben").sort((a, b) => Number(a.rang) - Number(b.rang));
      return (offen[1] || offen[0] || p.gebucht.spieler[0]).id;
    });
    await seite.click(`#hudDock [data-hud-spieler="${id}"]`);
    await setze(16);
    await aufnahme("02-folgen-karte");
    // 3) Regie mit Kamerawechsel zurueck (Esc schliesst die Karte, Kamera geht in die Regie), dann zur ersten Glocke
    await seite.keyboard.press("Escape");
    await spule(Math.max(simBisher, (zeiten?.ziel ?? 30) + 0.4));
    await setze(10);
    await aufnahme("03-regie-glocke");
    // 4) Endstand: erst die Endstand-Tafel, dann (geschlossen) die Totale mit allen oben und dem Dock im Endstand
    await seite.evaluate(() => window.__arena.canyonKamera("totale"));
    await spule(Math.max(simBisher, (zeiten?.ende ?? 60) + 0.5));
    await setze(10);
    await seite.waitForTimeout(3600);   // Einblender "Endstand" abklingen lassen
    await aufnahme("04-endstand");
    if (await seite.isVisible("#ezu")) await seite.click("#ezu");
    await aufnahme("05-totale-ende");
    await seite.close();
  }
  console.log("Seitenfehler: " + (fehler.length ? fehler.join(" | ") : "keine"));
} finally {
  if (browser) await browser.close();
  server.close();
}
