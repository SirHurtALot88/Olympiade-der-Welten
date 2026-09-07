// SPIEGELTEST FUER MINI-DM-4-TEAM-FFA (docs/design/mini-dm-4-team-ffa-recherche-06-09.md) —
// dieselbe Methode wie scripts/miss-arena-feldspiel-spiegel.mjs: VIER IDENTISCHE Kader (byte-
// identisches Deep-Clone, gleiche Reihenfolge) treten in derselben Runde gegeneinander an. Bei
// einer fairen Vierergruppe darf keine der vier Seiten strukturell bevorzugt sein — der Anteil
// an Rundensiegen (Platz 1) muss je Seite nahe 25 % liegen.
//
// Anders als beim Feldspiel-Spiegeltest gibt es hier VIER Positionen statt zwei, deshalb wird
// nicht nur "Sieg/Niederlage/Unentschieden" gezaehlt, sondern die volle Platzverteilung
// (1./2./3./4.) je Seite sowie der mittlere Beitrag (beitragVon) je Seite.
//
// Aufruf:
//   node scripts/miss-mini-dm-ffa-spiegel.mjs                → 96 Runden je Rolle
//   node scripts/miss-mini-dm-ffa-spiegel.mjs 200             → 200 Runden je Rolle
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";
import { existsSync } from "node:fs";

const N = Number(process.argv[2] || 96);
const hier = dirname(fileURLToPath(import.meta.url));
const seitePfad = process.argv[3] || resolve(hier, "..", "public", "mockups", "battle-mode.html");
if (!existsSync(seitePfad)) {
  console.error("Mockup nicht gefunden: " + seitePfad);
  process.exit(1);
}

// EIN Spieler, viermal per Deep-Clone dupliziert (im Browser, nicht davor — derselbe Weg wie
// im Feldspiel-Spiegeltest: kein geteilter Zustand zwischen den vier Kopien).
const D0 = { "mini-dm": 55 };
const SPIELER = {
  n: "Spiegel-Kaempfer", id: "spiegel-1", c: "Warlord", r: "Human",
  sub: [], tp: [], tn: [], groesse: null, d: { ...D0 },
  a: { power: 62, health: 58, stamina: 55, intelligence: 30, awareness: 40,
       determination: 45, speed: 50, dexterity: 52, charisma: 20, will: 48,
       spirit: 25, torment: 60 },
};

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

const ergebnisse = await page.evaluate(
  ({ spieler, n }) => {
    const rollen = window.__arena.miniDmFfaRollen();
    const out = [];
    for (const slotId of rollen) {
      for (let i = 0; i < n; i++) {
        const vier = [
          JSON.parse(JSON.stringify(spieler)),
          JSON.parse(JSON.stringify(spieler)),
          JSON.parse(JSON.stringify(spieler)),
          JSON.parse(JSON.stringify(spieler)),
        ];
        out.push(window.__arena.miniDmFfaRunde(vier, slotId, 500000 + i * 977));
      }
    }
    return out;
  },
  { spieler: SPIELER, n: N },
);

await browser.close();

if (fehler.length) {
  console.error("Seitenfehler:", fehler.slice(0, 5));
  process.exitCode = 1;
}

const platzZaehler = [0, 1, 2, 3].map(() => [0, 0, 0, 0]); // [seite][platz-1]
const beitragSumme = [0, 0, 0, 0];

for (const runde of ergebnisse) {
  for (const team of runde.teams) {
    platzZaehler[team.side][team.rundenPlatz - 1] += 1;
    beitragSumme[team.side] += team.beitrag;
  }
}

const gesamt = ergebnisse.length;
console.log(`Runden gesamt (alle 4 Rollen zusammen): ${gesamt}`);
console.log("");
console.log("Seite | Platz1 | Platz2 | Platz3 | Platz4 | Mittel-Beitrag");
for (let seite = 0; seite < 4; seite++) {
  const p = platzZaehler[seite].map((c) => ((100 * c) / gesamt).toFixed(1) + "%");
  console.log(
    `  ${seite}   | ${p[0].padStart(6)} | ${p[1].padStart(6)} | ${p[2].padStart(6)} | ${p[3].padStart(6)} | ${(beitragSumme[seite] / gesamt).toFixed(1)}`,
  );
}

const platz1Anteile = platzZaehler.map((z) => z[0] / gesamt);
const erwartungswert = 0.25;
const maxAbweichung = Math.max(...platz1Anteile.map((a) => Math.abs(a - erwartungswert)));
console.log("");
console.log(`Groesste Abweichung von 25% (Platz 1 je Seite): ${(100 * maxAbweichung).toFixed(1)} Prozentpunkte`);
