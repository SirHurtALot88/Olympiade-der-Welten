// SONDE BREAKING TAG-TEAM (22.11., docs/design/breaking-tagteam-22-11.md): Kampfverlauf-Statistik ueber viele Saaten
// (Ende durch Aufgabe oder Notbremse, Gaenge, Anschlaege, erste Aufgabe, Einsaetze, Waffenwahl). Rein lesend, Node-Motor.
//   node scripts/sonde-breaking-tagteam.mjs [saaten=48] [--regel=<json>] [--gauntlet]
import path from "node:path";
import { fileURLToPath } from "node:url";
import { oeffneNodeSeite } from "./lib/node-arena-seite.mjs";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const n = Number(args.find((a) => /^\d+$/.test(a)) || 48);
const regelArg = args.find((a) => a.startsWith("--regel="));
const seite = await oeffneNodeSeite(path.join(WURZEL, "public", "mockups"));
const aus = await seite.evaluate(({ n, regel, alt }) => {
  const A = window.__arena;
  A.breakingFormat(alt ? "gauntlet" : regel ? JSON.parse(regel) : null);
  const z = { n: 0, aufgabe: 0, notbremse: 0, gaenge: 0, anschlaege: 0, tot: 0 };
  const alle = [];
  for (let s = 1; s <= n; s += 1) {
    const r = A.spiele("breaking", s * 7919);
    const e = A.breakingEnde ? A.breakingEnde() : null;
    if (!e) continue;
    z.n += 1; z[e.art] += 1; z.gaenge += e.gaenge; z.anschlaege += e.anschlaege;
    alle.push({ seiten: r.seiten, e });
  }
  return { z, beispiel: alle.slice(0, 4) };
}, { n, regel: regelArg ? regelArg.slice(8) : null, alt: args.includes("--gauntlet") });
const z = aus.z;
console.log(`Kaempfe ${z.n}: Aufgabe ${z.aufgabe} (${Math.round((100 * z.aufgabe) / z.n)} %), Notbremse ${z.notbremse}, ` +
  `Gaenge im Mittel ${(z.gaenge / z.n).toFixed(1)}, Anschlaege im Mittel ${(z.anschlaege / z.n).toFixed(0)}`);
console.log(JSON.stringify(aus.beispiel));
seite.schliessen?.();
process.exit(0);
