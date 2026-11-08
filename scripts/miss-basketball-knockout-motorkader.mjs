// ===================================================================================
// KNOCKOUT-SONDE MIT MOTOR-KADERN (08.11., zweite Stufe) — KEINE ABNAHME, aber naeher dran.
//
// Die Vorab-Sonde (scripts/miss-basketball-knockout-prototyp.mjs) mischt die Teilwerte selbst aus
// den nackten Attributen. Diese Sonde holt sie stattdessen aus dem ECHTEN Motor: fuer jede Paarung
// der Kader-Familie und jedes Spiel baut battle-mode.engine.js die Basketball-Aufstellung genau wie
// disziplinProbe()/einflussVon() — mit der KI-Slotwahl (welche sechs spielen, auf welchem Slot),
// dem Slot-Aufschlag (engP/breitP), BASKETBALL_POS_MOD, den Formkarten des Spiels
// (zieheFormkarten) und den Mutator-Traits (zieheMutatorenWieSpiel, Modus "je-spiel"). Gelesen
// werden u.ftWert, TEAMGEIST, ZWEITCHANCE, LAUFTEMPO, SCHUSS_NAH, TECHNIK und die Eignung
// (eigOhneMutator wie disziplinProbe). Die Knockout-Mechanik selbst ist unveraendert die aus
// public/mockups/basketball-knockout-prototyp.sim.js.
//
// Pp: wie einflussVon() — Hebung ueber ATTR_HEBUNG im Motor (+15 auf ein Attribut eines Spielers,
// dieselben Form-/Mutator-/Bau-Saaten), dann dasselbe Knockout mit derselben Sim-Saat, Gewinn im
// eigenen Spielerwert, Anteile gegen die Matrix.
//
// MOTOR UNBERUEHRT: der Zugriff auf die Aufstellung (FSTEAM ist nicht exportiert) wird nur IM
// SPEICHER dieses Laufs in die ausgelieferte Motordatei eingehaengt (Playwright route), als eine
// zusaetzliche Lesefunktion neben feldspielSubskills(). Die Datei im Repo aendert sich nicht.
//
//   node scripts/miss-basketball-knockout-motorkader.mjs [spiele=48] [--saat-versatz=N]
//        [--pp=SPIELE] [--leben=3] [--losen=umlauf] [--wert=marge]
// ===================================================================================
import { createRequire } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve, join } from "node:path";

const wurzel = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const T = require(resolve(wurzel, "public/mockups/basketball-knockout-prototyp.sim.js"));
if (process.env.KO_K) Object.assign(T.K, JSON.parse(process.env.KO_K));
let chromium;
try { ({ chromium } = await import("playwright")); }
catch { ({ chromium } = require(join(process.env.OLY_HAUPT || "/home/user/Olympiade-der-Welten", "node_modules/playwright"))); }

const args = process.argv.slice(2);
const opt = (name, def) => { const a = args.find((x) => x.startsWith(`--${name}=`)); return a ? a.split("=")[1] : def; };
const N = Number(args.find((a) => !a.startsWith("--")) ?? 48);
const VERSATZ = Number(opt("saat-versatz", 0));
const PP_N = Number(opt("pp", 0));
const OPT = { leben: Number(opt("leben", 3)), losen: opt("losen", "umlauf"), wert: opt("wert", "marge") };

const familie = JSON.parse(readFileSync(resolve(wurzel, "data/generated/kaderfamilie-live-save.json"), "utf8")).varianten;
const SEITE = pathToFileURL(join(wurzel, "public/mockups/battle-mode.html")).href;
const KANAELE = ["TEAMGEIST", "ZWEITCHANCE", "LAUFTEMPO", "SCHUSS_NAH", "TECHNIK"];

// Lesefunktion, die nur im Speicher eingehaengt wird (s. Kopf). Laeuft im Motor-Closure.
const HAKEN = `knockoutKader:(familie,o)=>{
  const M=MOTOREN.basketball; const g=M.sichern(); if(M.vorher)M.vorher();
  const sqV=SQUAD, opV=OPP, mutV=MUTATOREN, hebV=ATTR_HEBUNG, formV=FORMKARTE;
  const K=${JSON.stringify(KANAELE)};
  const zug=()=>[...FSTEAM[0],...FSTEAM[1]].map(u=>[u.n,u.side,Math.round((u.eigOhneMutator!=null?u.eigOhneMutator:u.eig)*100)/100,u.ftWert,...K.map(k=>u[k]),u.slotId||null]);
  const out=[];
  try{
    for(const v of familie){
      SQUAD=mitKit(v.heim); OPP=mitKit(v.gast); neuPersBerechnen();
      const spiele=[];
      for(let i=o.von;i<o.bis;i++){
        const bau=()=>{zieheFormkarten(20260823+o.versatz+i*104729);
          MUTATOREN=zieheMutatorenWieSpiel(20260823+o.versatz+i*15485863);
          M.bau(1337+o.versatz+i*7919); return zug();};
        ATTR_HEBUNG=null; const grund=bau(); const heb={};
        if(o.pp){ for(const u of grund){ heb[u[0]]={};
          for(const at of EINFLUSS_ATTR){ ATTR_HEBUNG={wer:u[0],attribut:at,plus:15}; heb[u[0]][at]=bau(); } }
          ATTR_HEBUNG=null; }
        spiele.push({i,grund,heb});
      }
      out.push({label:v.label,spiele});
    }
  } finally { SQUAD=sqV; OPP=opV; MUTATOREN=mutV; ATTR_HEBUNG=hebV; FORMKARTE=formV; neuPersBerechnen(); M.zurueck(g); }
  return out;
},
feldspielSubskills:(dId)=>{`;

const fest = ["/opt/pw-browsers/chromium-1243/chrome-linux64/chrome", "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"].find(existsSync);
const browser = await chromium.launch(fest ? { executablePath: fest } : {});
const seite = await browser.newPage();
await seite.route("**/battle-mode.engine.js", async (route) => {
  const pfad = join(wurzel, "public/mockups/battle-mode.engine.js");
  const quelle = readFileSync(pfad, "utf8");
  const marke = "feldspielSubskills:(dId)=>{";
  if (quelle.split(marke).length !== 2) throw new Error("Einhaengepunkt feldspielSubskills nicht eindeutig");
  await route.fulfill({ contentType: "application/javascript", body: quelle.replace(marke, HAKEN) });
});
await seite.goto(SEITE);
await seite.waitForFunction(() => window.__arena && window.__arena.knockoutKader, null, { timeout: 60000 });

async function hole(von, bis, pp) {
  return seite.evaluate(([f, o]) => window.__arena.knockoutKader(f, o), [familie, { von, bis, versatz: VERSATZ, pp }]);
}
const zuSpieler = (zeile) => ({ n: zeile[0], seite: zeile[1], eig: zeile[2], slot: zeile[9],
  tw: { FREIWURF: zeile[3], ...Object.fromEntries(KANAELE.map((k, j) => [k, zeile[4 + j]])) } });
const spiel = (zeilen, saat) => {
  const sp = zeilen.map(zuSpieler);
  return T.spiele(sp.filter((u) => u.seite === 0), sp.filter((u) => u.seite === 1), saat, OPT).teilnehmer;
};
const simSaat = (i) => 1337 + VERSATZ + i * 7919;

function spearman(x, y) {
  const rang = (v) => { const idx = v.map((w, i) => [w, i]).sort((a, b) => a[0] - b[0]); const r = new Array(v.length);
    for (let i = 0; i < idx.length;) { let j = i; while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
      for (let k = i; k <= j; k++) r[idx[k][1]] = (i + j) / 2; i = j + 1; } return r; };
  const rx = rang(x), ry = rang(y), n = x.length, mx = rx.reduce((s, v) => s + v, 0) / n, my = ry.reduce((s, v) => s + v, 0) / n;
  let a = 0, b = 0, c = 0; for (let i = 0; i < n; i++) { a += (rx[i] - mx) * (ry[i] - my); b += (rx[i] - mx) ** 2; c += (ry[i] - my) ** 2; }
  return a / Math.sqrt(b * c || 1);
}
const median = (v) => { const s = [...v].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

// ---------------------------------------------------------------- rho je Spiel
const t0 = Date.now();
const basis = await hole(0, N, false);
let alle = [], stern1 = 0, stern2 = 0, sternN = 0, slotsGesehen = new Set();
console.log(`Knockout mit Motor-Kadern (leben=${OPT.leben} losen=${OPT.losen} wert=${OPT.wert}) — ${N} Spiele je Paarung, Saatversatz ${VERSATZ}`);
console.log("paarung                          rho/Spiel  Validitaet  Teilwerte (Median FW/TG/ZC/LT/NAH/TECH)");
for (const v of basis) {
  const einzel = [], summeW = new Map(), summeE = new Map(), tw = [];
  for (const s of v.spiele) {
    const z = spiel(s.grund, simSaat(s.i));
    einzel.push(spearman(z.map((u) => u.eig), z.map((u) => u.wert)));
    for (const u of z) { summeW.set(u.n, (summeW.get(u.n) ?? 0) + u.wert); summeE.set(u.n, (summeE.get(u.n) ?? 0) + u.eig); }
    const st = [...z].sort((a, b) => b.eig - a.eig)[0], pl = [...z].sort((a, b) => b.wert - a.wert).indexOf(st);
    if (pl === 0) stern1++; if (pl <= 1) stern2++; sternN++;
    for (const r of s.grund) { tw.push(r.slice(3, 9)); slotsGesehen.add(r[9]); }
  }
  const namen = [...summeW.keys()];
  const val = spearman(namen.map((n) => summeE.get(n)), namen.map((n) => summeW.get(n)));
  const med = [0, 1, 2, 3, 4, 5].map((j) => median(tw.map((t) => t[j]))).join("/");
  console.log(`${v.label.padEnd(32)} ${median(einzel).toFixed(3).padStart(9)}  ${val.toFixed(3).padStart(10)}  ${med}  (${namen.length} Spieler)`);
  alle = alle.concat(einzel);
}
console.log(`MEDIAN rho je Spiel ueber alle ${alle.length} Spiele: ${median(alle).toFixed(3)}  (Ziel > 0,80)`);
console.log(`Star auf Rang 1: ${(100 * stern1 / sternN).toFixed(0)} %, in den ersten zwei: ${(100 * stern2 / sternN).toFixed(0)} %`);
console.log(`Slots gesehen: ${[...slotsGesehen].join(", ")}  (${((Date.now() - t0) / 1000).toFixed(0)} s)`);

// ---------------------------------------------------------------- Pp nach einflussVon()
if (PP_N > 0) {
  const gewinn = Object.fromEntries(T.ATTRIBUTE.map((a) => [a, 0]));
  let proben = 0;
  for (let von = 0; von < PP_N; von += 4) {
    const block = await hole(von, Math.min(PP_N, von + 4), true);
    for (const v of block) for (const s of v.spiele) {
      const grund = new Map(spiel(s.grund, simSaat(s.i)).map((u) => [u.n, u.wert]));
      for (const wer of Object.keys(s.heb)) {
        for (const at of Object.keys(s.heb[wer])) {
          if (!(at in gewinn)) continue;
          const neu = spiel(s.heb[wer][at], simSaat(s.i)).find((u) => u.n === wer);
          gewinn[at] += (neu ? neu.wert : 0) - grund.get(wer);
        }
        proben++;
      }
    }
  }
  const pos = Object.values(gewinn).reduce((s, g) => s + Math.max(0, g), 0) || 1;
  const reihen = T.ATTRIBUTE.map((at) => ({ at, anteil: 100 * Math.max(0, gewinn[at]) / pos, matrix: T.MATRIX[at] }));
  const pp = reihen.reduce((s, r) => s + Math.abs(r.anteil - r.matrix), 0);
  console.log(`\nPp (${PP_N} Spiele je Paarung, ${proben} Proben)\nattribut        Anteil  Matrix  Diff`);
  for (const r of reihen.sort((a, b) => b.matrix - a.matrix || b.anteil - a.anteil))
    console.log(`${r.at.padEnd(14)} ${r.anteil.toFixed(1).padStart(7)} ${String(r.matrix).padStart(7)} ${(r.anteil - r.matrix).toFixed(1).padStart(6)}`);
  console.log(`Pp-Abweichung: ${pp.toFixed(1)}  (Ziel <= 25)  (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}
await browser.close();
