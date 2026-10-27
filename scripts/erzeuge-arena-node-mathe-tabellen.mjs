// Erzeugt lib/battle/arena-node-chromium-mathe-tabellen.mjs aus den C-Quellen, deren Algorithmen
// lib/battle/arena-node-chromium-mathe.mjs nachbildet (Quick-Sim, 27.10.):
//
//   sin/cos: V8 14.1 (Chromium 141), third_party/glibc/src/sysdeps/ieee754/dbl-64/{sincostab.c,branred.h}
//            https://chromium.googlesource.com/v8/v8/+/refs/heads/14.1-lkgr/third_party/glibc/
//   pow:     glibc 2.36 (Debian bookworm, das Produktions-Image) sysdeps/ieee754/dbl-64/
//            {e_pow_log_data.c,e_exp_data.c} -- in 2.39 algorithmisch identisch (nur Copyright/exp10).
//
// Aufruf: node scripts/erzeuge-arena-node-mathe-tabellen.mjs <sincostab.c> <e_pow_log_data.c> <e_exp_data.c>
// Die Tabellen landen als 32-Bit-Wortpaare (hoch, niedrig) im Ausgabemodul -- bitgenau, ohne
// Dezimal-Rundung.
import { readFileSync, writeFileSync } from "node:fs";

const [sincostabPfad, powLogPfad, expDataPfad] = process.argv.slice(2);
if (!sincostabPfad || !powLogPfad || !expDataPfad) {
  console.error("Aufruf: node scripts/erzeuge-arena-node-mathe-tabellen.mjs <sincostab.c> <e_pow_log_data.c> <e_exp_data.c>");
  process.exit(1);
}

const puffer = new DataView(new ArrayBuffer(8));
const worte = (x) => {
  puffer.setFloat64(0, x);
  return [puffer.getUint32(0), puffer.getUint32(4)];
};
const hex = (w) => `0x${w.toString(16).padStart(8, "0")}`;

/** C-Hex-Gleitkommaliteral (z. B. `-0x1.62c82f2b9c800p-2`), optional `* faktor`, exakt nach double. */
function hexFloat(text) {
  const t = text.trim();
  const m = t.match(/^([+-]?)0x([0-9a-f]+)(?:\.([0-9a-f]*))?p([+-]?\d+)(?:\s*\*\s*(-?\d+|N))?$/i);
  if (!m) throw new Error(`kein Hex-Float: ${text}`);
  const [, vz, ganz, bruch = "", exp, faktor] = m;
  const mantisse = BigInt(`0x${ganz}${bruch}`);
  if (mantisse >= 1n << 53n) throw new Error(`Mantisse > 53 Bit: ${text}`);
  let wert = Number(mantisse) * 2 ** (Number(exp) - 4 * bruch.length);
  if (vz === "-") wert = -wert;
  if (faktor) wert *= faktor === "N" ? 128 : Number(faktor);
  return wert;
}

// --- sincostab: BIG_ENDI-Abschnitt, je double zwei Worte (hoch, niedrig) ---
const sinQuelle = readFileSync(sincostabPfad, "utf8");
const bigEndi = sinQuelle.slice(sinQuelle.indexOf("#ifdef BIG_ENDI"), sinQuelle.indexOf("#else"));
const sinWorte = [...bigEndi.matchAll(/0x[0-9A-Fa-f]{8}/g)].map((x) => Number(x[0]));
if (sinWorte.length !== 880) throw new Error(`sincostab: ${sinWorte.length} statt 880 Worte`);

// --- pow_log_data: ln2hi, ln2lo, poly[7], tab[128] (invc, logc, logctail) ---
const powQuelle = readFileSync(powLogPfad, "utf8");
const feld = (name) => hexFloat(powQuelle.match(new RegExp(`\\.${name} = ([^,]+),`))[1]);
const polyBlock = powQuelle.slice(powQuelle.indexOf(".poly = {"), powQuelle.indexOf("},", powQuelle.indexOf(".poly = {")));
const powPoly = polyBlock
  .split("\n")
  .map((z) => z.replace(/\/\/.*$/, "").trim())
  .filter((z) => /^-?0x/.test(z))
  .map((z) => hexFloat(z.replace(/,$/, "")));
if (powPoly.length !== 7) throw new Error(`pow poly: ${powPoly.length} statt 7`);
const powTab = [...powQuelle.matchAll(/^A\(([^,]+), ([^,]+), ([^)]+)\)/gm)].map((m) => [hexFloat(m[1]), hexFloat(m[2]), hexFloat(m[3])]);
if (powTab.length !== 128) throw new Error(`pow tab: ${powTab.length} statt 128`);

// --- exp_data: invln2N, negln2hiN, negln2loN, shift, poly[4], tab[256] (uint64) ---
const expQuelle = readFileSync(expDataPfad, "utf8");
const expFeld = (name) => hexFloat(expQuelle.match(new RegExp(`\\.${name} = ([^,\\n]+),`))[1]);
const expPolyBlock = expQuelle.slice(expQuelle.indexOf(".poly = {"), expQuelle.indexOf("},", expQuelle.indexOf(".poly = {")));
const expPoly = expPolyBlock
  .split("\n")
  .map((z) => z.replace(/\/\/.*$/, "").trim())
  .filter((z) => /^-?0x/.test(z))
  .map((z) => hexFloat(z.replace(/,$/, "")));
if (expPoly.length !== 4) throw new Error(`exp poly: ${expPoly.length} statt 4`);
const tabBlock = expQuelle.slice(expQuelle.indexOf(".tab = {"));
const expTab = [...tabBlock.matchAll(/0x[0-9a-f]+/gi)].map((x) => BigInt(x[0]));
if (expTab.length !== 256) throw new Error(`exp tab: ${expTab.length} statt 256`);

const doubleWorte = (werte) => werte.flatMap(worte).map(hex);
const zeilen = (liste, jeZeile) => {
  const out = [];
  for (let i = 0; i < liste.length; i += jeZeile) out.push(`  ${liste.slice(i, i + jeZeile).join(", ")},`);
  return out.join("\n");
};
const skalar = (name, wert) => `export const ${name} = /* ${worte(wert).map(hex).join(" ")} */ ${wert};`;

const ausgabe = `// @ts-check
// GENERIERT von scripts/erzeuge-arena-node-mathe-tabellen.mjs -- nicht von Hand aendern.
// Quellen und Lizenz: s. Kopf von arena-node-chromium-mathe.mjs (glibc, LGPL 2.1).
// Doubles als 32-Bit-Wortpaare [hoch, niedrig], bitgenau aus den C-Quellen uebernommen.

/** V8 third_party/glibc sincostab.c: 440 doubles (je 4: sn, ssn, cs, ccs). */
export const SINCOSTAB_WORTE = [
${zeilen(sinWorte.map(hex), 8)}
];

/** glibc e_pow_log_data.c */
${skalar("POW_LN2HI", feld("ln2hi"))}
${skalar("POW_LN2LO", feld("ln2lo"))}
export const POW_POLY = [${powPoly.join(", ")}];
/** tab[i] = invc, logc, logctail (je drei doubles als Wortpaare). */
export const POW_TAB_WORTE = [
${zeilen(doubleWorte(powTab.flat()), 6)}
];

/** glibc e_exp_data.c (N = 128) */
${skalar("EXP_INVLN2N", expFeld("invln2N"))}
${skalar("EXP_NEGLN2HIN", expFeld("negln2hiN"))}
${skalar("EXP_NEGLN2LON", expFeld("negln2loN"))}
${skalar("EXP_SHIFT", expFeld("shift"))}
export const EXP_POLY = [${expPoly.join(", ")}];
/** tab[2k] = asuint64(T[k]), tab[2k+1] = asuint64(H[k]) - (k << 52)/N, je als Wortpaar. */
export const EXP_TAB_WORTE = [
${zeilen(expTab.flatMap((v) => [hex(Number(v >> 32n)), hex(Number(v & 0xffffffffn))]), 8)}
];
`;
writeFileSync(new URL("../lib/battle/arena-node-chromium-mathe-tabellen.mjs", import.meta.url), ausgabe);
console.log("geschrieben: lib/battle/arena-node-chromium-mathe-tabellen.mjs");
