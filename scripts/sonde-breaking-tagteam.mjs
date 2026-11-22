// SONDE BREAKING TAG-TEAM (22.11., docs/design/breaking-tagteam-22-11.md): Kampfverlauf-Statistik ueber viele Saaten und die ganze
// Kader-Familie (Ende durch Aufgabe oder Notbremse, Gaenge, Anschlaege), je Paarung und Feldgroesse. Rein lesend, Node-Motor.
//   node scripts/sonde-breaking-tagteam.mjs [saaten=48] [--regel=<json>] [--gauntlet] [--je-seite=3,4,5,6]
import path from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { oeffneNodeSeite } from "./lib/node-arena-seite.mjs";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const n = Number(args.find((a) => /^\d+$/.test(a)) || 48);
const regelArg = args.find((a) => a.startsWith("--regel="));
const jsArg = args.find((a) => a.startsWith("--je-seite="));
const jeSeiten = jsArg ? jsArg.slice(11).split(",").map(Number) : [6];
const fam = JSON.parse(readFileSync(path.join(WURZEL, "data/generated/kaderfamilie-live-save.json"), "utf8")).varianten;
const seite = await oeffneNodeSeite(path.join(WURZEL, "public", "mockups"));
const aus = await seite.evaluate(({ n, regel, alt, fam, jeSeiten }) => {
  const A = window.__arena;
  A.setDisc("breaking");
  A.breakingFormat(alt ? "gauntlet" : regel ? JSON.parse(regel) : null);
  const zeilen = [];
  fam.forEach((v, i) => {
    A.kaderSetzen({ heim: v.heim, gast: v.gast });
    for (const js of jeSeiten) {
      A.buehneJeSeiteQa(js);
      const z = { paarung: i, js, n: 0, aufgabe: 0, notbremse: 0, gaenge: 0, anschlaege: 0, unvollstaendig: 0 };
      for (let s = 1; s <= n; s += 1) {
        A.spieleBuehneGauntlet("breaking", s * 7919 + js);
        const e = A.breakingEnde();
        if (!e) continue;
        z.n += 1; z[e.art] += 1; z.gaenge += e.gaenge; z.anschlaege += e.anschlaege;
      }
      zeilen.push(z);
    }
  });
  return zeilen;
}, { n, regel: regelArg ? regelArg.slice(8) : null, alt: args.includes("--gauntlet"), fam, jeSeiten });
let gn = 0, gnb = 0;
for (const z of aus) {
  gn += z.n; gnb += z.notbremse;
  console.log(`Paarung ${z.paarung} je Seite ${z.js}: ${z.n} Kaempfe, Notbremse ${z.notbremse} (${Math.round((100 * z.notbremse) / z.n)} %), Gaenge ${(z.gaenge / z.n).toFixed(1)}, Anschlaege ${(z.anschlaege / z.n).toFixed(0)}`);
}
console.log(`Gesamt: ${gn} Kaempfe, Notbremse ${gnb} (${((100 * gnb) / gn).toFixed(1)} %)`);
seite.schliessen?.();
process.exit(0);
