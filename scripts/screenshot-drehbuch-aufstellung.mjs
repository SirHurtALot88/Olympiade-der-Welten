// ===================================================================================
// SCREENSHOTS DES DREHBUCH-MOCKUPS (B0'), vier Bilder je Aufstellung, plus die Probe
// "andere Aufstellung, andere Enthuellung".
//
//   node scripts/screenshot-drehbuch-aufstellung.mjs [zielordner]
//
// Bild 1: Aufstellungstafel mit Portraits, Befehl und Zielansage je Slot.
// Bild 2: der Klick auf "Aufstellung abgeben" — versiegelt, Einlauf.
// Bild 3: mitten in der Enthuellung, mit dem Rueckbezugs-Callout (Duell 2, Die Flanke).
// Bild 4: Endstand.
// Danach dieselben Bilder 3 fuer die drei anderen Beispiel-Aufstellungen, damit der
// Unterschied im Callout sichtbar ist, und ein Textabzug aller vier Drehbuecher.
// ===================================================================================
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SEITE = pathToFileURL(path.join(WURZEL, "public/mockups/drehbuch-aufstellung.html")).href;
const ZIEL = path.resolve(process.argv[2] || path.join(WURZEL, "docs/design/drehbuch-aufstellung-20-09"));
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
mkdirSync(ZIEL, { recursive: true });

const browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
const seite = await browser.newPage({ viewport: { width: 1360, height: 1000 }, colorScheme: "dark" });
const fehler = [];
seite.on("pageerror", (e) => fehler.push(String(e)));
// Google Fonts sind in der Agenten-Umgebung nicht erreichbar (Proxy-Zertifikat) — die
// Seite faellt dann auf Systemschriften zurueck; das ist kein Fehler des Mockups.
seite.on("console", (m) => { if (m.type() === "error" && !/net::ERR_/.test(m.text())) fehler.push("console: " + m.text()); });
await seite.goto(SEITE, { waitUntil: "networkidle" });
await seite.waitForFunction(() => window.__drehbuch && window.__drehbuch.bilderGeladen(), null, { timeout: 30000 });
await seite.waitForTimeout(600);

const schuss = async (name, el) => {
  const p = path.join(ZIEL, name);
  if (el) await seite.locator(el).screenshot({ path: p }); else await seite.screenshot({ path: p, fullPage: false });
  console.log("geschrieben:", p);
};

// Zufallssperre: die Marke muss gruen sein (ohne Klasse "kaputt").
const sperre = await seite.evaluate(() => ({ text: document.getElementById("zufallsfrei").textContent, kaputt: document.getElementById("zufallsfrei").classList.contains("kaputt") }));
console.log("Zufallssperre:", sperre.kaputt ? "NICHT AKTIV" : "aktiv", "—", sperre.text);

// ---- Beat 1: die Aufstellung
await seite.evaluate(() => window.__drehbuch.vorgabe("standard"));
await seite.evaluate(() => window.__drehbuch.manuell(true));
await seite.waitForTimeout(300);
await schuss("1-aufstellung.png", "#aufstellungFrame");

// ---- Beat 2: der Klick — versiegelt, Einlauf sichtbar
await seite.evaluate(() => window.__drehbuch.abgeben());
await seite.waitForTimeout(250);
await schuss("2-abgegeben.png", "#aufstellungFrame");
await seite.evaluate(() => window.scrollTo(0, document.getElementById("arena").offsetTop));
await seite.waitForTimeout(250);
await schuss("2b-einlauf.png", "#arena .frame");

// ---- Beat 3: Enthuellung mit Rueckbezug (Duell 2 "Die Flanke", Ansage-Callout)
const zeit = await seite.evaluate(() => window.__drehbuch.zeitachse());
const flanke = zeit[1];
await seite.evaluate((t) => window.__drehbuch.setzeUhr(t), flanke.ankunft + 0.35);
await seite.waitForTimeout(500);
await schuss("3-enthuellung-callout.png", "#arena .frame");
// zusaetzlich: mitten im Schlagwechsel und der Fall
await seite.evaluate((t) => window.__drehbuch.setzeUhr(t), flanke.ankunft + 1.15);
await seite.waitForTimeout(300);
await schuss("3b-schlag.png", "#arena .arenaraum");
await seite.evaluate((t) => window.__drehbuch.setzeUhr(t), flanke.fall + 0.5);
await seite.waitForTimeout(500);
await schuss("3c-fall-fazit.png", "#arena .arenaraum");

// ---- Beat 4: Endstand
await seite.evaluate(() => window.__drehbuch.setzeUhr(window.__drehbuch.dauer() - 0.05));
await seite.evaluate(() => window.__drehbuch.manuell(false));
await seite.waitForTimeout(700);
await schuss("4-endstand.png", "#arena .frame");

// ---- Andere Aufstellungen: dasselbe Duell 2, anderer Callout.
for (const k of ["bollwerk", "verfolgen", "tank"]) {
  await seite.evaluate((k) => { window.__drehbuch.vorgabe(k); window.__drehbuch.manuell(true); window.__drehbuch.abgeben(); }, k);
  await seite.waitForFunction(() => window.__drehbuch.bereit());
  await seite.evaluate(() => window.scrollTo(0, document.getElementById("arena").offsetTop));
  const z = await seite.evaluate(() => window.__drehbuch.zeitachse());
  await seite.evaluate((t) => window.__drehbuch.setzeUhr(t), z[1].ankunft + 0.35);
  await seite.waitForTimeout(500);
  await schuss("5-" + k + "-flanke-callout.png", "#arena .arenaraum");
  await seite.evaluate((t) => window.__drehbuch.setzeUhr(t), z[1].fall + 0.5);
  await seite.waitForTimeout(500);
  await schuss("5-" + k + "-flanke-fazit.png", "#arena .arenaraum");
  await seite.evaluate(() => window.__drehbuch.setzeUhr(window.__drehbuch.dauer() - 0.05));
  await seite.evaluate(() => window.__drehbuch.manuell(false));
  await seite.waitForTimeout(600);
  await schuss("5-" + k + "-endstand.png", "#arena .frame");
}

// ---- Textabzug aller vier Drehbuecher (Schluessel, Stand, Callouts).
const probe = await seite.evaluate(() => window.__drehbuch.probeAlle());
const zeilen = [];
for (const [k, v] of Object.entries(probe)) {
  zeilen.push("== " + k + " ==", "Schluessel: " + v.schluessel, "Stand: " + v.stand.join(":") + " (" + (v.sieg ? "Sieg" : "Niederlage") + ")", ...v.callouts.map((c) => "  · " + c), "");
}
writeFileSync(path.join(ZIEL, "drehbuecher.txt"), zeilen.join("\n"));
console.log(zeilen.join("\n"));
await browser.close();
if (fehler.length) { console.error("Seitenfehler:", fehler); process.exit(1); }
console.log("fertig:", ZIEL);
