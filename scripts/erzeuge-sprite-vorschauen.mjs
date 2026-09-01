// ===================================================================================
// SPRITE-VORSCHAUEN FUER DIE QA-GALERIE — erzeugt public/sprites/preview/<slug>.png
// fuer jeden Eintrag in data/generated/battle-arena-sprite-gallery.json neu.
//
// WARUM DAS UEBERHAUPT EIN SKRIPT BRAUCHT: FoundationBattleArenaSpriteGallery.tsx
// (Kommentar dort) sagt selbst, dass die 144 PNGs "per Skript aus genau demselben
// renderProbe() erzeugt" werden, das schon die Sichtcheck-Agents genutzt haben — aber
// bis zu diesem Commit gab es dieses Skript nirgends eingecheckt (ein frueherer Agent
// hat es offenbar nur ad-hoc gebaut, benutzt und wieder verworfen). Ergebnis: der
// Cache in public/sprites/preview/ wurde seit PR #667 nie mehr aktualisiert, obwohl an
// der BAU-Tabelle in public/mockups/battle-mode.engine.js seither mehrfach etwas
// geaendert wurde (u.a. die 24./25.08.-Sprite-Fixes und PR #706).
//
// POSE: renderProbe(name) OHNE weitere Argumente (kein ani/feldspiel/dir/lunge) — exakt
// der Aufruf, den der Gallerie-Kommentar meint. Das ergibt vx=0,vy=0,side=0, also ueber
// blickAus() Blickrichtung "rechts" (Zeile 3 des Blattes), lunge 0 — ein einzelnes
// stehendes Standbild, kein Kampf-/Lauf-Frame. Stichprobe an den bisherigen PNGs
// (vorrak.png, lava-golem.png) bestaetigt genau diese ruhige Steh-/Frontalpose.
//
// KEIN HTTP-SERVER NOETIG: anders als bei den Basketball-Court-Assets (die per fetch()
// echte Dateien unter /sprites/basketball/... nachladen, s. Kommentar in
// scripts/messe-arena-einfluss.mjs) liegen Kopf/Ruestung/Vollbild-Sprites als Base64 in
// der Engine-Datei selbst eingebettet — file:// reicht, dieselbe Technik wie in
// messe-arena-einfluss.mjs.
//
// Aufruf:
//   node scripts/erzeuge-sprite-vorschauen.mjs               → alle Eintraege
//   node scripts/erzeuge-sprite-vorschauen.mjs "Lava Golem"  → nur ein Name (Debug)
// ===================================================================================
import { chromium } from "playwright";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HIER = dirname(fileURLToPath(import.meta.url));
const REPO_WURZEL = join(HIER, "..");
const GALERIE_JSON = join(REPO_WURZEL, "data/generated/battle-arena-sprite-gallery.json");
const MOCKUP_PFAD = join(REPO_WURZEL, "public/mockups/battle-mode.html");
const ZIEL_ORDNER = join(REPO_WURZEL, "public/sprites/preview");

const nurName = process.argv[2];

const galerie = JSON.parse(readFileSync(GALERIE_JSON, "utf8"));
const eintraege = nurName ? galerie.filter((e) => e.name === nurName) : galerie;
if (nurName && eintraege.length === 0) {
  console.error(`Kein Galerie-Eintrag fuer "${nurName}" gefunden.`);
  process.exit(1);
}

mkdirSync(ZIEL_ORDNER, { recursive: true });

const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const seite = await browser.newPage();
const seitenfehler = [];
seite.on("pageerror", (e) => seitenfehler.push(String(e)));

await seite.goto("file://" + MOCKUP_PFAD, { waitUntil: "networkidle" });
await seite.waitForFunction(() => window.__arena && window.__arena.renderProbe, null, {
  timeout: 30000,
});

let ok = 0;
const fehlgeschlagen = [];
for (const { name, slug } of eintraege) {
  try {
    const dataUrl = await seite.evaluate((n) => window.__arena.renderProbe(n), name);
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, "");
    writeFileSync(join(ZIEL_ORDNER, `${slug}.png`), Buffer.from(base64, "base64"));
    ok++;
  } catch (e) {
    fehlgeschlagen.push({ name, fehler: String(e) });
  }
}

await browser.close();

console.log(`${ok}/${eintraege.length} Vorschauen geschrieben nach ${ZIEL_ORDNER}`);
if (seitenfehler.length) {
  console.log("Seitenfehler (JS-Fehler im Mockup, nicht ignorieren):");
  for (const f of seitenfehler.slice(0, 10)) console.log("  " + f);
}
if (fehlgeschlagen.length) {
  console.log(`${fehlgeschlagen.length} Eintraege fehlgeschlagen:`);
  for (const f of fehlgeschlagen) console.log(`  ${f.name}: ${f.fehler}`);
  process.exitCode = 1;
}
