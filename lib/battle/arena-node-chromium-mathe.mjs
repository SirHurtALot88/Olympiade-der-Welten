// @ts-check
/**
 * CHROMIUM-GLEICHE `Math.sin`/`Math.cos`/`Math.pow` FUER DEN NODE-MOTOR (Quick-Sim, 27.10.).
 *
 * WARUM (gemessen, nicht vermutet): Node 22 (V8 12.4) und Chromium 141 (V8 14.1), mit dem der
 * Chromium-Runner rechnet, liefern fuer DREI Math-Funktionen andere Bits — alle anderen
 * (tan, exp, log, atan2, hypot, sqrt, ...) sind bitgleich (120 000 Zufallsargumente je Funktion):
 *   - sin/cos: ~3 % der Argumente. V8 14 baut mit `v8_use_libm_trig_functions` und rechnet
 *     mit einer in V8 mitgelieferten glibc-Kopie (third_party/glibc, IBM Accurate Mathematical
 *     Library), Node 22 noch mit fdlibm.
 *   - pow (und `**`): ~8 %. V8 14 setzt `--use-std-math-pow` (Standard true) und ruft `std::pow`,
 *     also die glibc des Systems; Node 22 rechnet mit fdlibm (`legacy::pow`).
 * Eine Abweichung im letzten Bit genuegt: im Basketball-Feldspiel stieg sie ueber die
 * Positionsrechnung bis in die 3. Nachkommastelle eines Boxscore-Werts (Paritaetstest).
 *
 * WAS DIESE DATEI TUT: sie bildet genau die Algorithmen nach, die Chromium ausfuehrt, Operation
 * fuer Operation in derselben Reihenfolge (JS-Doubles sind IEEE-754 wie C-`double`), und
 * `installiereChromiumMathe()` setzt sie in den vm-Kontext des Motors — NUR dort, nie global.
 *
 *   sin/cos: V8 14.1 third_party/glibc/src/sysdeps/ieee754/dbl-64/s_sin.c + branred.c
 *            (Revision 4e21c2075193 laut README.v8), von V8 ohne FMA uebersetzt -> deterministisch,
 *            diese Nachbildung ist BITGLEICH (Test: tests/arena-node-chromium-mathe.test.ts).
 *   pow:     glibc 2.36 sysdeps/ieee754/dbl-64/e_pow.c (Debian bookworm = Produktions-Image;
 *            2.39 algorithmisch identisch) plus V8s Vorfilter aus src/numbers/ieee754.cc.
 *            Nachgebildet ist der Pfad OHNE FMA. Auf x86-Rechnern mit FMA/AVX2 waehlt glibc zur
 *            Laufzeit eine FMA-Variante (`__pow_fma`), deren Zwischenrundungen sich in seltenen
 *            Grenzfaellen (Ergebnis fast genau zwischen zwei Doubles) unterscheiden — dort kann
 *            das letzte Bit weiterhin abweichen. Gemessen ist das um Groessenordnungen seltener
 *            als die fdlibm-Abweichung (s. Test), und die Motor-Aufrufe mit nicht-ganzzahligem
 *            Exponenten speisen Wahrscheinlichkeiten, keine Positionen.
 *
 * Lizenz: die nachgebildeten Algorithmen und Tabellen stammen aus glibc (LGPL 2.1, Copyright
 * IBM / Free Software Foundation; e_pow.c: ARM Ltd./FSF). Die Tabellen erzeugt
 * scripts/erzeuge-arena-node-mathe-tabellen.mjs bitgenau aus den C-Quellen.
 */

import {
  EXP_INVLN2N,
  EXP_NEGLN2HIN,
  EXP_NEGLN2LON,
  EXP_POLY,
  EXP_SHIFT,
  EXP_TAB_WORTE,
  POW_LN2HI,
  POW_LN2LO,
  POW_POLY,
  POW_TAB_WORTE,
  SINCOSTAB_WORTE,
} from "./arena-node-chromium-mathe-tabellen.mjs";

// BigInt-Konstanten einmalig (das Projekt uebersetzt nach ES2017 -- keine `123n`-Literale).
const BI_32 = BigInt("32");
const BI_X3FE6955500000000 = BigInt("0x3fe6955500000000");
const BI_XFFFFFFFF00000000 = BigInt("0xffffffff00000000");
const BI_XFFFFFFFFF8000000 = BigInt("0xfffffffff8000000");
const BI_X3FF0000000000000 = BigInt("0x3ff0000000000000");
const BI_X7FF0000000000000 = BigInt("0x7ff0000000000000");
const BI_52 = BigInt("52");
const BI_45 = BigInt("45");
const BI_128 = BigInt("128");
const BI_XFFF = BigInt("0xfff");
const BI_1 = BigInt("1");
const BI_31 = BigInt("31");
const BI_X80000000 = BigInt("0x80000000");
const BI_0 = BigInt("0");
const BI_1009 = BigInt("1009");
const BI_1022 = BigInt("1022");
const BI_X8000000000000000 = BigInt("0x8000000000000000");
const BI_63 = BigInt("63");
const BI_X7FF = BigInt("0x7ff");
const BI_2 = BigInt("2");
const BI_X7FFFFFFFFFFFFFFF = BigInt("0x7fffffffffffffff");

// ---------------------------------------------------------------------------------------------
// Bit-Zugriff auf doubles (wie `mynumber`/`asuint64` in glibc)
// ---------------------------------------------------------------------------------------------

const puffer = new ArrayBuffer(8);
const f64 = new Float64Array(puffer);
const u32 = new Uint32Array(puffer);
const u64 = new BigUint64Array(puffer);
f64[0] = 1;
// glibc liest `i[HIGH_HALF]`/`i[LOW_HALF]`; hier ist das Wort-Layout des Hosts entscheidend.
const HOCH = u32[1] === 0x3ff00000 ? 1 : 0;
const NIEDRIG = 1 - HOCH;

/** @param {number} hoch @param {number} niedrig */
function ausWorten(hoch, niedrig) {
  u32[HOCH] = hoch;
  u32[NIEDRIG] = niedrig;
  return f64[0];
}
/** `u.i[HIGH_HALF]` als vorzeichenbehaftetes int4. @param {number} x */
function hochwort(x) {
  f64[0] = x;
  return u32[HOCH] | 0;
}
/** `u.i[LOW_HALF]` als vorzeichenbehaftetes int4. @param {number} x */
function niedrigwort(x) {
  f64[0] = x;
  return u32[NIEDRIG] | 0;
}
/** @param {number} x */
function asuint64(x) {
  f64[0] = x;
  return u64[0];
}
/** @param {bigint} i */
function asdouble(i) {
  u64[0] = BigInt.asUintN(64, i);
  return f64[0];
}
/** C-`copysign` (beruecksichtigt -0). @param {number} betrag @param {number} vorzeichen */
function copysign(betrag, vorzeichen) {
  const negativ = vorzeichen < 0 || Object.is(vorzeichen, -0);
  return negativ ? -Math.abs(betrag) : Math.abs(betrag);
}

/** @param {number[]} worte */
function doublesAusWorten(worte) {
  const out = new Float64Array(worte.length / 2);
  for (let i = 0; i < out.length; i += 1) out[i] = ausWorten(worte[2 * i], worte[2 * i + 1]);
  return out;
}

// ---------------------------------------------------------------------------------------------
// sin/cos — V8 third_party/glibc s_sin.c
// ---------------------------------------------------------------------------------------------

const SINCOSTAB = doublesAusWorten(SINCOSTAB_WORTE);

// usncs.h
const S1 = ausWorten(0xbfc55555, 0x55555555); // -0x1.5555555555555p-3
const S2 = ausWorten(0x3f811111, 0x11110ece); //  0x1.1111111110ECEp-7
const S3 = ausWorten(0xbf2a01a0, 0x19db08b8); // -0x1.A01A019DB08B8p-13
const S4 = ausWorten(0x3ec71de2, 0x7b9a7ed9); //  0x1.71DE27B9A7ED9p-19
const S5 = ausWorten(0xbe5addff, 0xc2fcdf59); // -0x1.ADDFFC2FCDF59p-26
const BIG = ausWorten(0x42c80000, 0x00000000); //  0x1.8p45
const HP0 = ausWorten(0x3ff921fb, 0x54442d18); //  0x1.921FB54442D18p0
const HP1 = ausWorten(0x3c91a626, 0x33145c07); //  0x1.1A62633145C07p-54
const MP1 = ausWorten(0x3ff921fb, 0x58000000); //  0x1.921FB58000000p0
const MP2 = ausWorten(0xbe4dde97, 0x3c000000); // -0x1.DDE973C000000p-27
const PP3 = ausWorten(0xbc8cb3b3, 0x98000000); // -0x1.CB3B398000000p-55
const PP4 = ausWorten(0xbacd747f, 0x23e32ed7); // -0x1.d747f23e32ed7p-83
const HPINV = ausWorten(0x3fe45f30, 0x6dc9c883); // 0x1.45F306DC9C883p-1
const TOINT = ausWorten(0x43380000, 0x00000000); // 0x1.8p52

// s_sin.c (statische Konstanten)
const SN3 = -1.66666666666664880952546298448555e-1;
const SN5 = 8.33333214285722277379541354343671e-3;
const CS2 = 4.99999999999999999999950396842453e-1;
const CS4 = -4.16666666666664434524222570944589e-2;
const CS6 = 1.38888874007937613028114285595617e-3;

/** TAYLOR_SIN(xx, x, dx) @param {number} xx @param {number} x @param {number} dx */
function taylorSin(xx, x, dx) {
  const polynom = (((S5 * xx + S4) * xx + S3) * xx + S2) * xx + S1;
  const t = (polynom * x - 0.5 * dx) * xx + dx;
  return x + t;
}

/** @param {number} x @param {number} dx */
function doCos(x, dx) {
  if (x < 0) dx = -dx;
  const ux = BIG + Math.abs(x);
  x = Math.abs(x) - (ux - BIG) + dx;
  const xx = x * x;
  const s = x + x * xx * (SN3 + xx * SN5);
  const c = xx * (CS2 + xx * (CS4 + xx * CS6));
  const k = niedrigwort(ux) << 2;
  const sn = SINCOSTAB[k];
  const ssn = SINCOSTAB[k + 1];
  const cs = SINCOSTAB[k + 2];
  const ccs = SINCOSTAB[k + 3];
  const cor = ccs - s * ssn - cs * c - sn * s;
  return cs + cor;
}

/** @param {number} x @param {number} dx */
function doSin(x, dx) {
  const xold = x;
  if (Math.abs(x) < 0.126) return taylorSin(x * x, x, dx);
  if (x <= 0) dx = -dx;
  const ux = BIG + Math.abs(x);
  x = Math.abs(x) - (ux - BIG);
  const xx = x * x;
  const s = x + (dx + x * xx * (SN3 + xx * SN5));
  const c = x * dx + xx * (CS2 + xx * (CS4 + xx * CS6));
  const k = niedrigwort(ux) << 2;
  const sn = SINCOSTAB[k];
  const ssn = SINCOSTAB[k + 1];
  const cs = SINCOSTAB[k + 2];
  const ccs = SINCOSTAB[k + 3];
  const cor = ssn + s * ccs - sn * c + cs * s;
  return copysign(sn + cor, xold);
}

// Rueckgabe-Register fuer die Reduktionen (statt Zeiger-Parametern in C).
let reduziertA = 0;
let reduziertDA = 0;

/** reduce_sincos: |x| < 105414350. @param {number} x */
function reduziereSinCos(x) {
  const t = x * HPINV + TOINT;
  const xn = t - TOINT;
  const y = x - xn * MP1 - xn * MP2;
  const n = niedrigwort(t) & 3;
  let t1 = xn * PP3;
  const t2 = y - t1;
  let db = y - t2 - t1;
  t1 = xn * PP4;
  const b = t2 - t1;
  db += t2 - b - t1;
  reduziertA = b;
  reduziertDA = db;
  return n;
}

/** @param {number} a @param {number} da @param {number} n */
function doSinCos(a, da, n) {
  const ergebnis = n & 1 ? doCos(a, da) : doSin(a, da);
  return n & 2 ? -ergebnis : ergebnis;
}

// branred.h (eigene Konstanten, NICHT die aus usncs.h)
const BR_T576 = ausWorten(0x63f00000, 0x00000000);
const BR_TM600 = ausWorten(0x1a700000, 0x00000000);
const BR_TM24 = ausWorten(0x3e700000, 0x00000000);
const BR_BIG = ausWorten(0x43380000, 0x00000000);
const BR_BIG1 = ausWorten(0x43580000, 0x00000000);
const BR_HP0 = ausWorten(0x3ff921fb, 0x54442d18);
const BR_HP1 = ausWorten(0x3c91a626, 0x33145c07);
const BR_MP1 = ausWorten(0x3ff921fb, 0x58000000);
const BR_MP2 = ausWorten(0xbe4dde97, 0x40000000);
const BR_SPLIT = 134217729.0; // CN = 2^27 + 1
const BR_TOVERP = [
  10680707.0, 7228996.0, 1387004.0, 2578385.0, 16069853.0, 12639074.0, 9804092.0, 4427841.0, 16666979.0, 11263675.0,
  12935607.0, 2387514.0, 4345298.0, 14681673.0, 3074569.0, 13734428.0, 16653803.0, 1880361.0, 10960616.0, 8533493.0,
  3062596.0, 8710556.0, 7349940.0, 6258241.0, 3772886.0, 3769171.0, 3798172.0, 8675211.0, 12450088.0, 3874808.0,
  9961438.0, 366607.0, 15675153.0, 9132554.0, 7151469.0, 3571407.0, 2607881.0, 12013382.0, 4155038.0, 6285869.0,
  7677882.0, 13102053.0, 15825725.0, 473591.0, 9065106.0, 15363067.0, 6271263.0, 9264392.0, 5636912.0, 4652155.0,
  7056368.0, 13614112.0, 10155062.0, 1944035.0, 9527646.0, 15080200.0, 6658437.0, 6231200.0, 6832269.0, 16767104.0,
  5075751.0, 3212806.0, 1398474.0, 7579849.0, 6349435.0, 12618859.0, 4703257.0, 12806093.0, 14477321.0, 2786137.0,
  12875403.0, 9837734.0, 14528324.0, 13719321.0, 343717.0,
];

/**
 * Eine Haelfte von `__branred` (die C-Quelle wiederholt denselben Block fuer x1 und x2).
 * @param {number} xt
 * @returns {[number, number, number]} [b, bb, sum]
 */
function branredTeil(xt) {
  const r = [0, 0, 0, 0, 0, 0];
  let sum = 0;
  let k = (hochwort(xt) >> 20) & 2047;
  k = Math.trunc((k - 450) / 24);
  if (k < 0) k = 0;
  let gor = ausWorten(((hochwort(BR_T576) - ((k * 24) << 20)) >>> 0), niedrigwort(BR_T576) >>> 0);
  for (let i = 0; i < 6; i += 1) {
    r[i] = xt * BR_TOVERP[k + i] * gor;
    gor *= BR_TM24;
  }
  for (let i = 0; i < 3; i += 1) {
    const s = r[i] + BR_BIG - BR_BIG;
    sum += s;
    r[i] -= s;
  }
  let t = 0;
  for (let i = 0; i < 6; i += 1) t += r[5 - i];
  let bb = r[0] - t + r[1] + r[2] + r[3] + r[4] + r[5];
  let s = t + BR_BIG - BR_BIG;
  sum += s;
  t -= s;
  const b = t + bb;
  bb = t - b + bb;
  s = sum + BR_BIG1 - BR_BIG1;
  sum -= s;
  return [b, bb, sum];
}

/** __branred: Reduktion fuer 105414350 <= |x| < 2^1024. @param {number} x */
function branred(x) {
  x *= BR_TM600;
  let t = x * BR_SPLIT;
  const x1 = t - (t - x);
  const x2 = x - x1;
  const [b1, bb1, sum1] = branredTeil(x1);
  const [b2, bb2, sum2] = branredTeil(x2);
  let sum = sum1 + sum2;
  let b = b1 + b2;
  let bb = Math.abs(b1) > Math.abs(b2) ? b1 - b + b2 : b2 - b + b1;
  if (b > 0.5) {
    b -= 1.0;
    sum += 1.0;
  } else if (b < -0.5) {
    b += 1.0;
    sum -= 1.0;
  }
  let s = b + (bb + bb1 + bb2);
  t = b - s + bb + (bb1 + bb2);
  b = s * BR_SPLIT;
  const t1 = b - (b - s);
  const t2 = s - t1;
  b = s * BR_HP0;
  bb = t1 * BR_MP1 - b + t1 * BR_MP2 + t2 * BR_MP1 + (t2 * BR_MP2 + s * BR_HP1 + t * BR_HP0);
  s = b + bb;
  t = b - s + bb;
  reduziertA = s;
  reduziertDA = t;
  return Math.trunc(sum) & 3;
}

/** glibc_sin (V8 libm_sin). @param {number} x */
export function chromiumSin(x) {
  const k = 0x7fffffff & hochwort(x);
  if (k < 0x3e500000) return x;
  if (k < 0x3feb6000) return doSin(x, 0);
  if (k < 0x400368fd) {
    const t = HP0 - Math.abs(x);
    return copysign(doCos(t, HP1), x);
  }
  if (k < 0x419921fb) {
    const n = reduziereSinCos(x);
    return doSinCos(reduziertA, reduziertDA, n);
  }
  if (k < 0x7ff00000) {
    const n = branred(x);
    return doSinCos(reduziertA, reduziertDA, n);
  }
  return x / x;
}

/** glibc_cos (V8 libm_cos). @param {number} x */
export function chromiumCos(x) {
  const k = 0x7fffffff & hochwort(x);
  if (k < 0x3e400000) return 1.0;
  if (k < 0x3feb6000) return doCos(x, 0);
  if (k < 0x400368fd) {
    const y = HP0 - Math.abs(x);
    const a = y + HP1;
    const da = y - a + HP1;
    return doSin(a, da);
  }
  if (k < 0x419921fb) {
    const n = reduziereSinCos(x);
    return doSinCos(reduziertA, reduziertDA, n + 1);
  }
  if (k < 0x7ff00000) {
    const n = branred(x);
    return doSinCos(reduziertA, reduziertDA, n + 1);
  }
  return x / x;
}

// ---------------------------------------------------------------------------------------------
// pow — glibc e_pow.c (Pfad ohne FMA) + V8 math::pow-Vorfilter
// ---------------------------------------------------------------------------------------------

const POW_TAB = doublesAusWorten(POW_TAB_WORTE); // je 3: invc, logc, logctail
const EXP_TAB = (() => {
  const out = new Array(EXP_TAB_WORTE.length / 2);
  for (let i = 0; i < out.length; i += 1) out[i] = (BigInt(EXP_TAB_WORTE[2 * i]) << BI_32) | BigInt(EXP_TAB_WORTE[2 * i + 1]);
  return out;
})();
const [A0, A1, A2, A3, A4, A5, A6] = POW_POLY;
const [C2, C3, C4, C5] = EXP_POLY;

const OFF = BI_X3FE6955500000000;
const SIGN_BIAS = 0x800 << 7;
const MASKE_OBEN32 = BI_XFFFFFFFF00000000; // (-1ULL << 32)
const MASKE_OBEN37 = BI_XFFFFFFFFF8000000; // (-1ULL << 27)
const BITS_EINS = BI_X3FF0000000000000;
const BITS_UNENDLICH = BI_X7FF0000000000000;
const MOD64 = (/** @type {bigint} */ wert) => BigInt.asUintN(64, wert);

/** @param {number} x */
function top12(x) {
  return Number(asuint64(x) >> BI_52);
}
const TOP12_2HOCHM54 = top12(2 ** -54);
const TOP12_512 = top12(512);
const TOP12_1024 = top12(1024);

/** @param {number} vorzeichen */
function mathOflow(vorzeichen) {
  const y = 2 ** 769;
  return (vorzeichen ? -y : y) * y;
}
/** @param {number} vorzeichen */
function mathUflow(vorzeichen) {
  const y = 2 ** -767;
  return (vorzeichen ? -y : y) * y;
}

let logRest = 0;

/** log_inline (ohne FMA): hi zurueck, Rest in `logRest`. @param {bigint} ix */
function logInline(ix) {
  const tmp = MOD64(ix - OFF);
  const i = Number((tmp >> BI_45) % BI_128);
  const k = Number(BigInt.asIntN(64, tmp) >> BI_52);
  const iz = MOD64(ix - (tmp & (BI_XFFF << BI_52)));
  const z = asdouble(iz);
  const kd = k;
  const invc = POW_TAB[3 * i];
  const logc = POW_TAB[3 * i + 1];
  const logctail = POW_TAB[3 * i + 2];

  const zhi = asdouble((iz + (BI_1 << BI_31)) & MASKE_OBEN32);
  const zlo = z - zhi;
  const rhi = zhi * invc - 1.0;
  const rlo = zlo * invc;
  const r = rhi + rlo;

  const t1 = kd * POW_LN2HI + logc;
  const t2 = t1 + r;
  const lo1 = kd * POW_LN2LO + logctail;
  const lo2 = t1 - t2 + r;

  const ar = A0 * r;
  const ar2 = r * ar;
  const ar3 = r * ar2;
  const arhi = A0 * rhi;
  const arhi2 = rhi * arhi;
  const hi = t2 + arhi2;
  const lo3 = rlo * (ar + arhi);
  const lo4 = t2 - hi + arhi2;
  const p = ar3 * (A1 + r * A2 + ar2 * (A3 + r * A4 + ar2 * (A5 + r * A6)));
  const lo = lo1 + lo2 + lo3 + lo4 + p;
  const y = hi + lo;
  logRest = hi - y + lo;
  return y;
}

/** specialcase aus e_pow.c. @param {number} tmp @param {bigint} sbits @param {bigint} ki */
function powSonderfall(tmp, sbits, ki) {
  if ((ki & BI_X80000000) === BI_0) {
    const scale = asdouble(MOD64(sbits - (BI_1009 << BI_52)));
    return 2 ** 1009 * (scale + scale * tmp);
  }
  sbits = MOD64(sbits + (BI_1022 << BI_52));
  const scale = asdouble(sbits);
  let y = scale + scale * tmp;
  if (Math.abs(y) < 1.0) {
    let eins = 1.0;
    if (y < 0.0) eins = -1.0;
    let lo = scale - y + scale * tmp;
    const hi = eins + y;
    lo = eins - hi + y + lo;
    y = hi + lo - eins;
    if (y === 0.0) y = asdouble(sbits & BI_X8000000000000000);
  }
  return 2 ** -1022 * y;
}

/** exp_inline aus e_pow.c. @param {number} x @param {number} xtail @param {number} vorzeichenBias */
function expInline(x, xtail, vorzeichenBias) {
  let abstop = top12(x) & 0x7ff;
  if (((abstop - TOP12_2HOCHM54) >>> 0) >= ((TOP12_512 - TOP12_2HOCHM54) >>> 0)) {
    if (((abstop - TOP12_2HOCHM54) >>> 0) >= 0x80000000) {
      const eins = 1.0 + x;
      return vorzeichenBias ? -eins : eins;
    }
    if (abstop >= TOP12_1024) {
      if (asuint64(x) >> BI_63) return mathUflow(vorzeichenBias);
      return mathOflow(vorzeichenBias);
    }
    abstop = 0;
  }
  const z = EXP_INVLN2N * x;
  let kd = z + EXP_SHIFT;
  const ki = asuint64(kd);
  kd -= EXP_SHIFT;
  let r = x + kd * EXP_NEGLN2HIN + kd * EXP_NEGLN2LON;
  r += xtail;
  const idx = 2 * Number(ki % BI_128);
  const top = MOD64((ki + BigInt(vorzeichenBias)) << BI_45);
  const tail = asdouble(EXP_TAB[idx]);
  const sbits = MOD64(EXP_TAB[idx + 1] + top);
  const r2 = r * r;
  const tmp = tail + r + r2 * (C2 + r * C3) + r2 * r2 * (C4 + r * C5);
  if (abstop === 0) return powSonderfall(tmp, sbits, ki);
  const scale = asdouble(sbits);
  return scale + scale * tmp;
}

/** 0: keine Ganzzahl, 1: ungerade, 2: gerade. @param {bigint} iy */
function checkint(iy) {
  const e = Number((iy >> BI_52) & BI_X7FF);
  if (e < 0x3ff) return 0;
  if (e > 0x3ff + 52) return 2;
  if (iy & ((BI_1 << BigInt(0x3ff + 52 - e)) - BI_1)) return 0;
  if (iy & (BI_1 << BigInt(0x3ff + 52 - e))) return 1;
  return 2;
}

/** @param {bigint} i */
function zeroinfnan(i) {
  return MOD64(BI_2 * i - BI_1) >= MOD64(BI_2 * BITS_UNENDLICH - BI_1);
}

/** glibc __pow (Pfad ohne FMA). @param {number} x @param {number} y */
function glibcPow(x, y) {
  let vorzeichenBias = 0;
  let ix = asuint64(x);
  const iy = asuint64(y);
  let topx = top12(x);
  const topy = top12(y);
  if (((topx - 0x001) >>> 0) >= 0x7ff - 0x001 || (((topy & 0x7ff) - 0x3be) >>> 0) >= 0x43e - 0x3be) {
    if (zeroinfnan(iy)) {
      if (MOD64(BI_2 * iy) === BI_0) return 1.0;
      if (ix === BITS_EINS) return 1.0;
      if (MOD64(BI_2 * ix) > MOD64(BI_2 * BITS_UNENDLICH) || MOD64(BI_2 * iy) > MOD64(BI_2 * BITS_UNENDLICH)) return x + y;
      if (MOD64(BI_2 * ix) === MOD64(BI_2 * BITS_EINS)) return 1.0;
      if ((MOD64(BI_2 * ix) < MOD64(BI_2 * BITS_EINS)) === !(iy >> BI_63)) return 0.0;
      return y * y;
    }
    if (zeroinfnan(ix)) {
      let x2 = x * x;
      if (ix >> BI_63 && checkint(iy) === 1) {
        x2 = -x2;
        vorzeichenBias = 1;
      }
      if (MOD64(BI_2 * ix) === BI_0 && iy >> BI_63) return (vorzeichenBias ? -1.0 : 1.0) / 0.0;
      return iy >> BI_63 ? 1 / x2 : x2;
    }
    if (ix >> BI_63) {
      const yint = checkint(iy);
      if (yint === 0) return NaN;
      if (yint === 1) vorzeichenBias = SIGN_BIAS;
      ix &= BI_X7FFFFFFFFFFFFFFF;
      topx &= 0x7ff;
    }
    if ((((topy & 0x7ff) - 0x3be) >>> 0) >= 0x43e - 0x3be) {
      if (ix === BITS_EINS) return 1.0;
      if ((topy & 0x7ff) < 0x3be) return ix > BITS_EINS ? 1.0 + y : 1.0 - y;
      return (ix > BITS_EINS) === topy < 0x800 ? mathOflow(0) : mathUflow(0);
    }
    if (topx === 0) {
      ix = asuint64(x * 2 ** 52);
      ix &= BI_X7FFFFFFFFFFFFFFF;
      ix -= BI_52 << BI_52;
    }
  }
  const hi = logInline(ix);
  const lo = logRest;
  const yhi = asdouble(iy & MASKE_OBEN37);
  const ylo = y - yhi;
  const lhi = asdouble(asuint64(hi) & MASKE_OBEN37);
  const llo = hi - lhi + lo;
  const ehi = yhi * lhi;
  const elo = ylo * lhi + y * llo;
  return expInline(ehi, elo, vorzeichenBias);
}

/** V8 14.1 `math::pow` mit `use_std_math_pow` (src/numbers/ieee754.cc). @param {number} x @param {number} y */
export function chromiumPow(x, y) {
  if (Number.isNaN(y)) return NaN;
  if ((y === Infinity || y === -Infinity) && (x === 1 || x === -1)) return NaN;
  if (y === 2) return x * x;
  if (y === 0.5) {
    if (x === Infinity || x === -Infinity) return Infinity;
    return Math.sqrt(x + 0);
  }
  return glibcPow(x, y);
}

// ---------------------------------------------------------------------------------------------
// Einbau in den vm-Kontext
// ---------------------------------------------------------------------------------------------

/**
 * Ersetzt `Math.sin`/`Math.cos`/`Math.pow` des uebergebenen (Kontext-)`Math`-Objekts durch die
 * Chromium-Nachbildung. Argumente laufen wie bei den eingebauten Funktionen durch ToNumber.
 * Aufzurufen VOR dem Laden des Motors, damit auch zwischengespeicherte Referenzen
 * (`const {sin} = Math`) die Nachbildung erwischen.
 *
 * @param {{ sin: Function; cos: Function; pow: Function }} mathObjekt
 */
export function installiereChromiumMathe(mathObjekt) {
  const definiere = (/** @type {string} */ name, /** @type {Function} */ fn) =>
    Object.defineProperty(mathObjekt, name, { value: fn, writable: true, configurable: true, enumerable: false });
  definiere("sin", function sin(/** @type {unknown} */ x) {
    return chromiumSin(Number(x));
  });
  definiere("cos", function cos(/** @type {unknown} */ x) {
    return chromiumCos(Number(x));
  });
  definiere("pow", function pow(/** @type {unknown} */ x, /** @type {unknown} */ y) {
    return chromiumPow(Number(x), Number(y));
  });
}
