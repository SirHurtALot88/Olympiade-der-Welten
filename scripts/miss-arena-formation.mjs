// MISST DIE FORMATION, NICHT DIE RANGTREUE.
//
// Chris' Meldung vom 13.09. zum Live-TDM war eine Aussage ueber das BILD, nicht ueber die
// Zahlen: „TDM ist noch zu statisch ... so richtig ne formation front und backrow gibt es
// nciht, da musst du die slots konsequenter umsetzen."
//
// rho kann diese Frage grundsaetzlich nicht beantworten — Rangtreue sagt, ob die Mechanik
// das Richtige belohnt, und kein Wort darueber, wo jemand steht. Also wird hier direkt
// gemessen, was er gesehen hat: der Abstand zwischen der vordersten und der hintersten
// besetzten Reihe, ueber den ganzen Kampf abgetastet.
//
// AUSGABE, drei Zahlen je Disziplin:
//   Reihenabstand   mittlerer/medianer Abstand Front->Backrow in Pixeln. homeFor() setzt
//                   ihn beim Start auf 160 px je Reihe (Spalten MID∓140/300/460). Faellt er
//                   im Kampf gegen 0, ist die Aufstellung ein Startbild und sonst nichts.
//   verkehrt        Anteil der Abtastungen, in denen die HINTERE Reihe VOR der vorderen
//                   steht — die Formation ist dann nicht nur flach, sondern umgedreht.
//   Durchbruch      Anteil der Einheit-Abtastungen mit aktivem Durchbruch. Der Durchbruch
//                   hebt die Formationsleine auf; ist er der Normalzustand statt der
//                   Ausnahme, gibt es per Konstruktion keine Formation mehr.
//
// Aufruf:
//   node scripts/miss-arena-formation.mjs                    -> 24 Kaempfe, alle drei Arena-Disziplinen
//   node scripts/miss-arena-formation.mjs 48 tdm             -> 48 Kaempfe, nur TDM
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";
import { existsSync } from "node:fs";

const args = process.argv.slice(2);
const N = Number(args[0] || 24);
const DISZIPLINEN = args.slice(1).length ? args.slice(1) : ["tdm", "mini-dm", "battlefield"];

const hier = dirname(fileURLToPath(import.meta.url));
const seitePfad = resolve(hier, "..", "public", "mockups", "battle-mode.html");
if (!existsSync(seitePfad)) {
  console.error("Mockup nicht gefunden: " + seitePfad);
  process.exit(1);
}

const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const browser = await chromium.launch(
  existsSync(fest)
    ? { executablePath: fest, args: ["--proxy-server=direct://", "--host-resolver-rules=MAP * 0.0.0.0"] }
    : { args: ["--proxy-server=direct://", "--host-resolver-rules=MAP * 0.0.0.0"] },
);
const page = await browser.newPage();
const fehler = [];
page.on("pageerror", (e) => fehler.push(String(e)));

await page.goto(pathToFileURL(seitePfad).href);
await page.waitForFunction(() => Boolean(window.__arena), null, { timeout: 15000 });

const roh = await page.evaluate(
  ({ disziplinen, n }) => {
    const out = {};
    for (const d of disziplinen) {
      const laeufe = [];
      for (let i = 0; i < n; i++) {
        // Dieselbe Saatenreihe wie miss-alle-disziplinen.mjs: 1337 + i*7919.
        const p = window.__arena.arenaFormation(d, 1337 + i * 7919);
        if (p) laeufe.push(p);
      }
      out[d] = laeufe;
    }
    return out;
  },
  { disziplinen: DISZIPLINEN, n: N },
);

await browser.close();

if (fehler.length) {
  console.error("Seitenfehler:", fehler.slice(0, 5));
  process.exitCode = 1;
}

const median = (xs) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};
const mittel = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

console.log(`Arena-Formation — ${N} Kaempfe je Disziplin, Abtastung alle 0,5 s Kampfzeit`);
console.log("");
console.log(
  "Disziplin".padEnd(16) +
    "Reihenabstand px".padStart(18) +
    "Median px".padStart(12) +
    "verkehrt".padStart(11) +
    "Durchbruch".padStart(12) +
    "Zwang".padStart(9) +
    "Dauer s".padStart(10),
);
for (const d of DISZIPLINEN) {
  const l = roh[d] || [];
  if (!l.length) {
    console.log(d.padEnd(16) + "— kein Lauf".padStart(18));
    continue;
  }
  console.log(
    d.padEnd(16) +
      mittel(l.map((x) => x.reihenAbstandMittel)).toFixed(1).padStart(18) +
      median(l.map((x) => x.reihenAbstandMedian)).toFixed(1).padStart(12) +
      (100 * mittel(l.map((x) => x.verkehrtAnteil))).toFixed(1).concat(" %").padStart(11) +
      (100 * mittel(l.map((x) => x.durchAnteil))).toFixed(1).concat(" %").padStart(12) +
      (100 * mittel(l.map((x) => x.zwangAnteil))).toFixed(1).concat(" %").padStart(9) +
      mittel(l.map((x) => x.dauer)).toFixed(1).padStart(10),
  );
}
console.log("");
console.log("Reihenabstand = mittlerer Abstand der hintersten zur vordersten BESETZTEN Reihe,");
console.log("in Blickrichtung der jeweiligen Seite. Startwert aus homeFor(): 160 px je Reihe.");
console.log("verkehrt = Anteil der Abtastungen, in denen die hintere Reihe vor der vorderen steht.");
