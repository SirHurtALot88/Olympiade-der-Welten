// ===================================================================================
// SPRITE-ATLANTEN FUER DAS DREHBUCH-MOCKUP (B0', PM-Plan 20.09. Abschnitt 3.4).
//
// Das Mockup public/mockups/drehbuch-aufstellung.html soll ECHTE Figuren zeigen — dieselben
// Baukasten-Blaetter (public/sprites/baukasten/), dieselbe Umfaerbung, dieselben Vollbild-
// Kreaturen wie in der Arena — aber es darf den Motor nicht einbinden (Auflage: nichts, was
// battle-mode.engine.js' Sim-/Wertungspfad beruehrt, und keine Kopie von 30.000 Zeilen
// Zeichencode). Der Weg dazwischen: die Figuren werden hier EINMAL ueber die bestehende
// Diagnose-Schnittstelle `window.__arena.renderProbe()` (rein zeichnend, kein rr(), kein
// Gameplay-Seiteneffekt, s. Kommentar dort) vorgerendert und als Atlas-PNG abgelegt. Das
// Mockup zeichnet dann nur noch drawImage() aus diesen Atlanten.
//
//   node scripts/rendere-drehbuch-sprites.mjs
//
// Schreibt public/mockups/drehbuch/<slug>.png und public/mockups/drehbuch/sprites.js (Bildtabelle).
//
// BILDWAHL ohne Zeitgeber: zeichneSprite() waehlt das Gehbild als floor((t*7+u.id)%n).
// renderProbe() kopiert ein `viz`-Objekt unveraendert auf u — auch `id`. Mit t=0 (kein
// laufender Kampf) und viz={id:k} ist das Bild also genau k. Angriffsbilder laufen ueber
// `lunge`: Bild = floor((1-lunge/0.2)*n). Beides wird hier ausgenutzt; doppelte Bilder
// (wenn n kleiner als die Abtastung ist) werden verworfen.
// ===================================================================================
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SEITE = pathToFileURL(path.join(WURZEL, "public/mockups/battle-mode.html")).href;
const ZIEL = path.join(WURZEL, "public/mockups/drehbuch");
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

// Die zwoelf Figuren des Drehbuchs — sechs je Seite, alle aus SQUAD/OPP des Battle-Mode-
// Entwurfs (Vigilante Wranglers gegen Armageddon Aftermath, echte Kader aus dem Spielstand).
const FIGUREN = [
  ["Draco", "draco"], ["Krolach", "krolach"], ["Johanna", "johanna"], ["Gram", "gram"],
  ["Jorund", "jorund"], ["Inefinna", "inefinna"],
  ["Greenkraut", "greenkraut"], ["Krag'Zul", "krag-zul"], ["Tidesprinter", "tidesprinter"],
  ["Seraph-11", "seraph-11"], ["Ralazar the Balanced", "ralazar-the-balanced"], ["Cassandra", "cassandra"],
];
const ZELLE = 160;            // Leinwand je Bild — gross genug fuer Krag'Zul (Z~1,7)
const ANKER = { x: 80, y: 112 }; // Zeichenpunkt (Koerpermitte/Fusszone) in der Zelle
const RICHTUNGEN = { l: 1, r: 3 }; // renderProbe-dir: 1 links, 3 rechts
const ANIS = ["walk", "atk", "idle", "hurt"];

mkdirSync(ZIEL, { recursive: true });
const browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
const seite = await browser.newPage();
const fehler = [];
seite.on("pageerror", (e) => fehler.push(String(e)));
await seite.goto(SEITE, { waitUntil: "networkidle" });
await seite.waitForFunction(() => window.__arena && window.__arena.renderProbe, null, { timeout: 30000 });
// Die Blaetter laden asynchron nach; ein leerer Atlas waere sonst moeglich.
await seite.waitForTimeout(1500);

const manifest = { zelle: ZELLE, anker: ANKER, reihen: [], figuren: {} };
for (const ani of ANIS) for (const r of Object.keys(RICHTUNGEN)) manifest.reihen.push(ani + "_" + r);

for (const [name, slug] of FIGUREN) {
  const ergebnis = await seite.evaluate(async ({ name, ZELLE, ANKER, RICHTUNGEN, ANIS }) => {
    const A = window.__arena;
    const probe = (ani, dir, extra) => A.renderProbe(name, ani, false, dir, extra.lunge ?? null, ZELLE, null, ANKER, extra.viz || null);
    const reihen = {};
    for (const ani of ANIS) {
      for (const [rk, dir] of Object.entries(RICHTUNGEN)) {
        const bilder = [];
        if (ani === "walk") {
          for (let k = 0; k < 9; k++) bilder.push(probe("walk", dir, { lunge: 0, viz: { id: k } }));
        } else if (ani === "atk") {
          for (let k = 0; k < 13; k++) bilder.push(probe("slash", dir, { lunge: 0.2 * (1 - (k + 0.5) / 13), viz: { id: 0 } }));
        } else if (ani === "idle") {
          bilder.push(probe("idle", dir, { lunge: 0, viz: { id: 0 } }));
        } else {
          bilder.push(probe("hurt", dir, { lunge: 0, viz: { id: 0 } }));
        }
        // Doppelte Nachbarbilder verwerfen (Abtastung feiner als die Bildzahl).
        const einzig = bilder.filter((b, i) => i === 0 || b !== bilder[i - 1]);
        reihen[ani + "_" + rk] = einzig;
      }
    }
    // Atlas zusammensetzen: eine Zeile je Reihe, Spalten = Bilder.
    const namen = Object.keys(reihen);
    const maxN = Math.max(...namen.map((k) => reihen[k].length));
    const c = document.createElement("canvas");
    c.width = ZELLE * maxN; c.height = ZELLE * namen.length;
    const cx = c.getContext("2d");
    const lade = (d) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.src = d; });
    const zaehler = {};
    for (let z = 0; z < namen.length; z++) {
      const bilder = reihen[namen[z]];
      zaehler[namen[z]] = bilder.length;
      for (let s = 0; s < bilder.length; s++) cx.drawImage(await lade(bilder[s]), s * ZELLE, z * ZELLE);
    }
    return { png: c.toDataURL("image/png"), zaehler, breite: c.width, hoehe: c.height };
  }, { name, ZELLE, ANKER, RICHTUNGEN, ANIS });
  const b64 = ergebnis.png.replace(/^data:image\/png;base64,/, "");
  writeFileSync(path.join(ZIEL, slug + ".png"), Buffer.from(b64, "base64"));
  manifest.figuren[name] = { slug, bilder: ergebnis.zaehler };
  console.log(name.padEnd(22), Object.entries(ergebnis.zaehler).map(([k, v]) => k + ":" + v).join(" "), "->", ergebnis.breite + "x" + ergebnis.hoehe);
}
await browser.close();
// Als JS-Datei statt JSON: das Mockup wird per file:// geoeffnet, und dort blockiert Chromium
// fetch() — ein <script>-Tag mit reinen Daten laedt dagegen ueberall.
writeFileSync(path.join(ZIEL, "sprites.js"),
  "// Generiert von scripts/rendere-drehbuch-sprites.mjs — reine Daten, kein Code.\n"
  + "window.DREHBUCH_SPRITES=" + JSON.stringify(manifest, null, 1) + ";\n");
if (fehler.length) { console.error("Seitenfehler:", fehler); process.exit(1); }
console.log("fertig:", ZIEL);
