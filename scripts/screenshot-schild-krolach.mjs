// Sichtpruefung fuer den Schild (Draco/Johanna) und Krolachs Energiekern + rote Augen
// (04.09.). Kein Teil der Abnahme-Sonden — nur zum Ansehen/Belegen, dasselbe Muster wie
// scripts/screenshot-gewichtheben.mjs. Nutzt die bestehenden Debug-Hooks window.__arena.
// renderProbe (Live-Arena-Zeichenroutine, s. zeichneSprite) und .figurProbe (Kader-/
// Aufstellungs-Vorschau, s. figur()) — beide brauchen keinen Squad-/Kampfaufbau, s.
// Kommentar an den Hooks selbst in battle-mode.engine.js.
import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const WURZEL = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const SEITE = pathToFileURL(path.join(WURZEL, "public/mockups/battle-mode.html")).href;
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const outDir = process.argv[2] || path.join(WURZEL, "tmp-ux-audit");
mkdirSync(outDir, { recursive: true });

// name, kind ("figur"|"arena"), ani/feldspiel/dir/lunge/leinwand (nur "arena"), Dateiname.
const JOBS = [
  { name: "Draco", kind: "figur", file: "schild-draco-figur.png" },
  { name: "Draco", kind: "arena", ani: "walk", feldspiel: false, dir: 2, leinwand: 160, file: "schild-draco-arena-front.png" },
  { name: "Draco", kind: "arena", ani: "slash", feldspiel: false, dir: 3, lunge: 0.1, leinwand: 160, file: "schild-draco-arena-slash.png" },
  { name: "Johanna", kind: "figur", file: "schild-johanna-figur.png" },
  { name: "Johanna", kind: "arena", ani: "walk", feldspiel: false, dir: 2, leinwand: 160, file: "schild-johanna-arena-front.png" },
  { name: "Krolach", kind: "figur", file: "krolach-energiekern-figur.png" },
  { name: "Krolach", kind: "arena", ani: "walk", feldspiel: false, dir: 2, leinwand: 160, file: "krolach-energiekern-arena-front.png" },
  { name: "Vorrak", kind: "arena", ani: "walk", feldspiel: false, dir: 2, leinwand: 160, file: "vorrak-voidrot-zum-vergleich.png" },
];

const browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
const seite = await browser.newPage({ viewport: { width: 800, height: 600 } });
const fehler = [];
seite.on("pageerror", (e) => fehler.push(String(e)));
await seite.goto(SEITE, { waitUntil: "networkidle" });
await seite.waitForFunction(() => window.__arena && window.__arena.renderProbe && window.__arena.figurProbe, null, { timeout: 30000 });

for (const job of JOBS) {
  const dataUrl = job.kind === "figur"
    ? await seite.evaluate((n) => window.__arena.figurProbe(n), job.name)
    : await seite.evaluate(
        (a) => window.__arena.renderProbe(a.name, a.ani, a.feldspiel, a.dir, a.lunge, a.leinwand),
        job
      );
  writeFileSync(path.join(outDir, job.file), Buffer.from(dataUrl.split(",")[1], "base64"));
  console.log("Screenshot:", path.join(outDir, job.file));
}
console.log("Seitenfehler:", fehler.length ? fehler.join(" | ") : "keine");
await browser.close();
