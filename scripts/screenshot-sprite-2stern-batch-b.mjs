// Vorher/Nachher-Sichtpruefung fuer den Sprite-2-Stern-Batch B (16.10.), elf Charaktere.
// Kein Teil der Abnahme-Sonden — nur zum Ansehen/Belegen, dasselbe Muster wie
// scripts/screenshot-schild-krolach.mjs. Nutzt window.__arena.renderProbe/.figurProbe.
import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const WURZEL = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const SEITE = pathToFileURL(path.join(WURZEL, "public/mockups/battle-mode.html")).href;
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const outDir = process.argv[2] || path.join(WURZEL, "tmp-ux-audit");
mkdirSync(outDir, { recursive: true });

const NAMEN = ["Myrkos","Orichalcos","Othrama","Pinkypie","PixiKat","Starbound",
  "Steel Sinister","Timantha","Tsubaki Cleaning","Velkin","Vorrak"];

const JOBS = NAMEN.flatMap((n) => {
  const slug = n.toLowerCase().replace(/'/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return [
    { name: n, kind: "arena", ani: "walk", feldspiel: false, dir: 2, leinwand: 160, file: `${slug}-nachher-arena-front.png` },
    { name: n, kind: "figur", file: `${slug}-nachher-figur.png` },
  ];
});

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
