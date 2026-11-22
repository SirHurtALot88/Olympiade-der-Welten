// Diagnose Maru-Fall: spielt eine aus dem Abbild gezogene Basketball-Begegnung (scripts/diagnose-maru-fixture.ts)
// im Node-Motor nach und zaehlt je Spieler die Ballaktionen aus dem Protokoll.
// Aufruf: node scripts/diagnose-maru-replay.mjs <fixture.json> [saat] [--puste=alt|neu]
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { baueMotorKontext, ladeMotorSkripte } from "../lib/battle/arena-node-motor.mjs";

const hier = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const fix = JSON.parse(readFileSync(args[0], "utf8"));
const saat = Number(args[1] ?? fix.seed);
const mockup = path.resolve(hier, "..", "public", "mockups");
const skripte = ladeMotorSkripte(mockup);
const kontext = baueMotorKontext();
const kader = {
  heim: fix.heim, gast: fix.gast, aufstellung: fix.aufstellung, mutatoren: [],
  kulisseByDisciplineId: fix.kulisseByDisciplineId ?? {},
  ...(fix.formatByDisciplineId ? { formatByDisciplineId: fix.formatByDisciplineId } : {}),
};
kontext.fenster.__olyNodeUebergabe = JSON.stringify(kader);
vm.runInContext("window.__olyArenaKader = JSON.parse(window.__olyNodeUebergabe); delete window.__olyNodeUebergabe;", kontext.fenster);
vm.runInContext("window.AudioContext = undefined; window.webkitAudioContext = undefined;", kontext.fenster);
skripte.rezepte.runInContext(kontext.fenster);
skripte.engine.runInContext(kontext.fenster);
for (let i = 0; i < 2000 && !kontext.fenster.__arena; i += 1) await new Promise((r) => setImmediate(r));
const A = kontext.fenster.__arena;
const roh = JSON.parse(JSON.stringify(A.spieleFeldspiel("basketball", saat)));
console.log("seiten", roh.seiten);
kontext.fenster.__olyNodeSaat = saat;
const zuege = JSON.parse(vm.runInContext(
  `JSON.stringify(window.__arena.spiele("basketball", window.__olyNodeSaat).protokoll.map(e => { const o = {}; for (const k of Object.keys(e)) { const v = e[k]; o[k] = (v && typeof v === "object" && v.n !== undefined) ? { n: v.n, side: v.side } : (v && typeof v === "object" ? undefined : v); } return o; }))`,
  kontext.fenster));
const arten = {};
for (const e of zuege) arten[e.art] = (arten[e.art] ?? 0) + 1;
console.log("ereignisse", zuege.length, arten);
console.log("beispiel", JSON.stringify(zuege.slice(0, 3)));
const sub = JSON.parse(JSON.stringify(A.feldspielSubskills("basketball")));
const losG = (w) => Math.pow(Math.max(1, w - 20), 2);
const qual = (m) => Math.max(0.01, 0.16 + m.TECHNIK * 0.005 + m.TEAMGEIST * 0.006);
console.log("Subskills und Passgewicht (ABSCHLUSS-20)^2 * qualitaet^2:");
for (const m of sub) console.log("  ", m.n.padEnd(22), "seite", m.side, "ABSCHLUSS", String(Math.round(m.ABSCHLUSS)).padStart(3), "TECHNIK", String(Math.round(m.TECHNIK)).padStart(3), "TEAMGEIST", String(Math.round(m.TEAMGEIST)).padStart(3), "AUSDAUER", String(Math.round(m.AUSDAUER)).padStart(3), "Gewicht", (losG(m.ABSCHLUSS) * qual(m) ** 2).toFixed(0));
const wert = Object.fromEntries(roh.boxscore.map((b) => [b.name, b.wert]));
const z = {};
const g = (n) => (z[n] ??= { wurf: 0, treffer: 0, pass: 0, reb: 0, steal: 0, block: 0, verlust: 0, ereignisse: 0 });
for (const e of zuege) {
  const n = e.spieler?.n;
  if (!n) continue;
  const s = g(n); s.ereignisse++;
  if (e.art === "treffer") { s.wurf++; s.treffer++; }
  else if (e.art === "fehlwurf") s.wurf++;
  else if (e.art === "rebound") s.reb++;
  else if (e.art === "steal") s.steal++;
  else if (e.art === "block") s.block++;
  else if (e.art === "turnover" || e.art === "verlust") s.verlust++;
  if (e.passgeber?.n) g(e.passgeber.n).pass++;
}
for (const n of Object.keys(wert)) console.log(n.padEnd(22), String(wert[n]).padStart(7), JSON.stringify(z[n] ?? {}));
kontext.aufraeumen();
