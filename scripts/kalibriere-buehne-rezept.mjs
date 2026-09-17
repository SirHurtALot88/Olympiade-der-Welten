// ===================================================================================
// DAS BUEHNEN-REZEPT AUSRECHNEN STATT RATEN — das Buehnen-Gegenstueck zu
// scripts/baue-feldspiel-rezept.mjs, das es bis hierher nicht gab (s. die Kommentare bei
// BUEHNE_ART.tennis/.fechten in battle-mode.engine.js: "fehlt fuer die Buehne weiterhin das
// Werkzeug"; docs/design/fechten-rezeptkalibrierung-16-09.md, "Kein dediziertes Sinkhorn-
// Werkzeug fuer Buehne").
//
// WARUM EIN EIGENES WERKZEUG UND KEIN SINKHORN-UMBAU: die Buehnen-Punkteformel ist kein
// Transportproblem. Fuer ein Rezept zaehlen hier ZWEI Groessen zugleich, und sie ziehen in
// verschiedene Richtungen (docs/design/fechten-aufwertungsplan-17-09.md, Abschnitt 2):
//
//   VALIDITAET      rho(Eignung, Erwartungswert der Punkte) — belohnt das Rezept das, was die
//                   Matrix bepreist? Steigt, je naeher die Attributmischung ALLER Rollen an
//                   der Matrix liegt (Matrix in jeder Rolle: 0,97).
//   VERLAESSLICHKEIT wie stark das Wuerfelrauschen (Erfolg/Fehlschlag je Durchgang) die
//                   Rangfolge EINES Spiels verwischt. Sinkt, wenn die Rollen breit mischen —
//                   ein gewichteter Schnitt ueber acht Attribute streut weniger als eine
//                   scharfe Drei-Attribut-Mischung, und weniger Streuung ist weniger Signal
//                   gegen dasselbe Rauschen.
//
// Ein Sinkhorn-Rezept (Matrix-Treue je Rolle) maximiert nur die erste Groesse. Dieses Skript
// misst deshalb die EINZELSPIEL-Rangtreue selbst — mit einer bit-genauen Nachbildung des
// generischen Durchgangs-Rechners (bauBuehne()/setz()/rr() aus battle-mode.engine.js) — und
// sucht systematisch, statt von Hand (Grid-Suche in 5-Punkt-Schritten, deterministische
// Saat, Semantik-Schranke je Rolle, s. ERLAUBT unten). Die Nachbildung rechnet ein Rezept in
// Millisekunden statt in Sekunden; ueber `--pruefe` laeuft der gefundene Stand danach durch
// den ECHTEN Motor (disziplinProbe in einer Mockup-Kopie, dieselbe Zahl wie
// miss-alle-disziplinen.mjs), damit keine Zahl aus der Nachbildung allein in ein Dokument
// wandert.
//
//   node scripts/kalibriere-buehne-rezept.mjs fechten
//       Ist-Stand: kaderfeste Rangtreue (Nachbildung), Zerlegung in Validitaet/Verlaesslichkeit,
//       Zahl je Kader-Variante, mechanisches Gewicht der sieben Rollen.
//   node scripts/kalibriere-buehne-rezept.mjs fechten --vergleich
//       Selbsttest: Nachbildung gegen den echten Motor (Playwright), muss bit-identisch sein.
//   node scripts/kalibriere-buehne-rezept.mjs fechten --suche [schritte] [--rundenN 18] [--frei]
//       Systematische Suche. Ziel: Mittel von rho/Spiel ueber die fuenf offiziellen Kader-
//       Paarungen PLUS acht deterministische Mischkader aus denselben 110 Spielern (gegen
//       Ueberanpassung an die fuenf). Ausgabe: Rezeptblock zum Einsetzen, Kontrolle auf
//       HELD-OUT-Saaten und HELD-OUT-Mischkadern, die die Suche nie gesehen hat.
//   node scripts/kalibriere-buehne-rezept.mjs fechten --pruefe <rezept.json> [--rundenN 18]
//       Echte Motor-Messung eines Kandidaten (Kopie von battle-mode.*, Rezept/rundenN nur dort
//       eingesetzt, Arbeitsbaum bleibt unangetastet).
//
// Gilt fuer jede Buehnen-Disziplin, die durch den generischen Durchgangs-Rechner laeuft
// (auch duell/duett). `heben:true` (Gewichtheben) hat einen eigenen Paar-Rechner und wird
// abgelehnt.
// ===================================================================================
import { readFileSync, writeFileSync, mkdtempSync, copyFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { rho, auswerten, median, spannweite, ladeKaderFamilieAusDatei } from "./lib/rangtreue-messung.mjs";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MOCKUP = path.join(WURZEL, "public/mockups");
const KADERFAMILIE_PFAD = process.env.OLY_KADER_FAMILIE || path.join(WURZEL, "data/generated/kaderfamilie-live-save.json");

// ---------------------------------------------------------------------------------
// Aufruf
// ---------------------------------------------------------------------------------
const args = process.argv.slice(2);
const DISZIPLIN = args.find((a) => !a.startsWith("--")) || "fechten";
const hat = (f) => args.includes(f);
const wert = (f, d) => { const i = args.indexOf(f); return i >= 0 && args[i + 1] != null ? args[i + 1] : d; };
const RUNDEN_N_ARG = wert("--rundenN", null);
const SPIELE = Number(wert("--spiele", 24));

// ---------------------------------------------------------------------------------
// WO EIN ATTRIBUT UEBERHAUPT HINGEHOEREN DARF — die einzige Stelle mit Semantik (dasselbe
// Muster wie ERLAUBT in baue-feldspiel-rezept.mjs). Ohne Eintrag darf jede Rolle jedes
// Matrix-Attribut tragen (`--frei` erzwingt das auch mit Eintrag).
// ---------------------------------------------------------------------------------
const ERLAUBT = {
  // Fechten (Degen): torment = Druck/Aggression, dexterity = Klingenarbeit, speed = Beinarbeit/
  // Tempo, awareness = Lesen des Gegners, power = Ausfall, determination/health/intelligence =
  // Kopf und Koerper ueber neun bis achtzehn Gaenge.
  fechten: {
    GRUNDLAGE: ["torment", "dexterity", "awareness", "speed"],
    SPITZENMOMENT: ["dexterity", "speed", "torment", "power"],
    TECHNIK: ["dexterity", "awareness", "torment", "speed", "intelligence"],
    NERVEN: ["awareness", "determination", "intelligence", "health", "torment"],
    PUBLIKUM: ["torment", "power", "intelligence", "health", "speed", "determination"],
    AUSDAUER: ["health", "speed", "power", "determination"],
    WAGNIS: ["speed", "power", "torment", "determination"],
  },
};

// ---------------------------------------------------------------------------------
// Motor-Daten aus battle-mode.engine.js lesen: Matrix, Slots, BUEHNE_ART-Eintrag. Kein
// zweites Zahlenlager — das Skript liest dieselbe Datei, die der Motor faehrt.
// ---------------------------------------------------------------------------------
function klammerBlock(quelle, von, auf = "{", zu = "}") {
  let tiefe = 0;
  for (let i = von; i < quelle.length; i++) {
    if (quelle[i] === auf) tiefe++;
    else if (quelle[i] === zu) { tiefe--; if (tiefe === 0) return quelle.slice(von, i + 1); }
  }
  throw new Error("Klammer nicht geschlossen ab Position " + von);
}
const literal = (text) => new Function("return (" + text + ");")();
function liesMotor(engineQuelle, d) {
  const basisIdx = engineQuelle.indexOf("const BASIS_JE_DISC={");
  const basisBlock = klammerBlock(engineQuelle, basisIdx + "const BASIS_JE_DISC=".length);
  const mm = basisBlock.match(new RegExp(`"${d}":\\s*(\\{[^}]*\\})`));
  if (!mm) throw new Error(`Keine Matrix fuer "${d}" in BASIS_JE_DISC.`);
  const matrix = literal(mm[1]);
  const slotsIdx = engineQuelle.indexOf("const SLOTS_JE_DISC={");
  const slotsBlock = klammerBlock(engineQuelle, slotsIdx + "const SLOTS_JE_DISC=".length);
  const sm = slotsBlock.match(new RegExp(`"${d}":\\s*\\[`));
  if (!sm) throw new Error(`Keine Slots fuer "${d}" in SLOTS_JE_DISC.`);
  const slots = literal(klammerBlock(slotsBlock, sm.index + sm[0].length - 1, "[", "]"));
  const artIdx = engineQuelle.indexOf("const BUEHNE_ART={");
  const artBlock = klammerBlock(engineQuelle, artIdx + "const BUEHNE_ART=".length);
  const re = new RegExp(`\\n    "?${d}"?:\\{`, "g");
  let m, eintrag = null, eintragStart = -1;
  while ((m = re.exec(artBlock))) {
    const kandidat = klammerBlock(artBlock, m.index + m[0].length - 1);
    if (kandidat.includes("rezept:{")) { eintrag = kandidat; eintragStart = artIdx + "const BUEHNE_ART=".length + m.index + m[0].length - 1; break; }
  }
  if (!eintrag) throw new Error(`"${d}" ist keine Buehnen-Disziplin (kein BUEHNE_ART-Eintrag mit rezept).`);
  const ohneKommentare = eintrag.replace(/\/\/[^\n]*/g, "");
  const rezeptIdx = ohneKommentare.indexOf("rezept:{");
  const rezeptText = klammerBlock(ohneKommentare, rezeptIdx + "rezept:".length);
  const zahl = (name, fallback) => { const z = ohneKommentare.match(new RegExp(`\\b${name}:\\s*([0-9.]+(?:/\\([^)]*\\))?)`)); return z ? literal(z[1]) : fallback; };
  const art = {
    jeSeite: zahl("jeSeite", 6), rundenN: zahl("rundenN", null), failAbzug: zahl("failAbzug", 0.55),
    duell: /\bduell:\s*true/.test(ohneKommentare), duett: /\bduett:\s*true/.test(ohneKommentare), heben: /\bheben:\s*true/.test(ohneKommentare),
    rezept: literal(rezeptText),
  };
  if (art.heben) throw new Error(`"${d}" laeuft ueber baueHebenDuelle(), nicht ueber den generischen Durchgangs-Rechner — nicht nachgebildet.`);
  if (art.rundenN == null) throw new Error(`rundenN fuer "${d}" nicht lesbar.`);
  // Fuer --pruefe: die Textstelle des Rezepts im Original (mit Kommentaren) fuer den Austausch.
  const rezeptIdxOrig = eintrag.indexOf("rezept:{");
  const rezeptTextOrig = klammerBlock(eintrag, rezeptIdxOrig + "rezept:".length);
  return { matrix, slots, art, eintragStart, eintrag, rezeptTextOrig };
}

// ---------------------------------------------------------------------------------
// DIE NACHBILDUNG — Zeichen fuer Zeichen die Rechnung aus bauBuehne()/setz(): Slot-Aufschlag
// (slotAufschlag/mitAufschlag), Formkarte (zieheFormkarten, obere Bits), Sub-Skills (mische),
// Durchgaenge (rr(): derselbe LCG), Duell-/Duett-Zweig. Selbsttest: `--vergleich`.
// ---------------------------------------------------------------------------------
const FORMWERTE = [0, 2, 4, 8];
function gewichtet(a, profil) { let s = 0, w = 0; for (const k in profil) { const g = profil[k] || 0; if (g > 0 && a[k] != null) { s += g * a[k]; w += g; } } return w ? s / w : 0; }
const mische = (a, rez) => { let s = 0, w = 0; for (const [at, wt] of Object.entries(rez)) { s += (a[at] || 0) * wt; w += wt; } return Math.max(1, Math.min(99, Math.round(s / w))); };

function bereiteVariante(motor, d, v, n, { saat0 = 1337, schritt = 7919, formSaat0 = 20260823 } = {}) {
  const { matrix, slots, art } = motor;
  const summeW = Object.values(matrix).reduce((x, y) => x + y, 0);
  const breit = Object.keys(matrix).filter((k) => matrix[k] > 0);
  const slotAufschlag = (p, sl) => { const roh = (gewichtet(p.a, sl.profil) - gewichtet(p.a, matrix)) * 2.2; return Math.max(-8.5, Math.min(8.5, Math.round(roh * 10) / 10)); };
  const mitAufschlag = (a, punkte, attrs) => {
    if (!punkte || !attrs || !attrs.length) return a;
    const traegt = attrs.reduce((x, k) => x + (matrix[k] || 0) * (a[k] || 0), 0) / summeW;
    if (traegt <= 0) return a;
    const f = 1 + punkte / traegt; const b = { ...a }; for (const k of attrs) b[k] = Math.max(0, (a[k] || 0) * f); return b;
  };
  // Eng: die beiden Fokus-Attribute des Slots, sofern sie Matrixgewicht tragen und in REC.power
  // vorkommen (rezeptVon() liefert fuer jede Buehnen-Disziplin REC.power, s. engine.js) — sonst breit.
  const REC_POWER = ["power", "torment", "determination", "charisma", "health", "spirit", "stamina", "speed", "dexterity", "awareness"];
  const engAttrs = (sl) => { const fokus = [sl.gross, sl.klein].filter((k) => matrix[k] > 0); return fokus.some((k) => REC_POWER.includes(k)) ? fokus : breit; };
  const jeSeite = art.jeSeite;
  const mine = [...v.heim].sort((a, b) => (b.d[d] || 0) - (a.d[d] || 0)).slice(0, jeSeite);
  const gegner = v.gast.slice(0, jeSeite);
  const spiele = [];
  for (let i = 0; i < n; i++) {
    let z = formSaat0 + i * 104729;
    const r = (m) => { z = (Math.imul(z, 1103515245) + 12345) & 0x7fffffff; return (z >>> 16) % m; };
    const FORM = {};
    for (const p of v.heim) FORM[p.n] = FORMWERTE[r(4)];
    for (const p of v.gast) FORM[p.n] = FORMWERTE[r(4)];
    const teilnehmer = [];
    const setz = (p, seite, idx) => {
      const sl = slots[idx % Math.max(1, slots.length)];
      const engP = sl ? slotAufschlag(p, sl) : 0;
      const breitP = FORM[p.n] || 0;
      let attr = mitAufschlag(p.a, engP, sl ? engAttrs(sl) : breit);
      attr = mitAufschlag(attr, breitP, breit);
      teilnehmer.push({ n: p.n, seite, attr, eig: (p.d[d] != null ? p.d[d] : gewichtet(p.a, matrix)) + engP + breitP });
    };
    mine.forEach((p, k) => setz(p, 0, k));
    gegner.forEach((p, k) => setz(p, 1, k));
    spiele.push({ saat: saat0 + i * schritt, teilnehmer });
  }
  return { label: v.label, spiele };
}

// Ein vorbereitetes Spiel mit einem Rezept durchrechnen -> [{n, eig, wert}]. `opt.rundenN`/
// `opt.failAbzug` ueberschreiben den Motorwert (fuer die Rundenzahl-Frage).
function spieleSpiel(motor, spiel, R, opt = {}) {
  const art = motor.art;
  const rundenN = opt.rundenN || art.rundenN, failAbzug = opt.failAbzug != null ? opt.failAbzug : art.failAbzug;
  let seed = spiel.saat || 1337;
  const rr = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const T = spiel.teilnehmer.map((t) => {
    const L = {}; for (const k in R) L[k] = mische(t.attr, R[k]);
    const runden = [];
    for (let ri = 0; ri < rundenN; ri++) {
      const ermued = 1 - Math.max(0, (60 - L.AUSDAUER)) * 0.0035 * (ri / Math.max(1, rundenN - 1));
      const basis = (20 + L.GRUNDLAGE * 0.7) * Math.max(0.4, ermued);
      const erfolg = Math.min(0.94, 0.15 + L.TECHNIK * 0.0055 + L.NERVEN * 0.0035);
      let punkte;
      if (rr() < erfolg) punkte = basis + L.SPITZENMOMENT * 0.35 * (0.4 + L.WAGNIS * 0.006);
      else punkte = basis * failAbzug;
      runden.push(Math.max(0, Math.round(punkte + L.PUBLIKUM * 0.12)));
    }
    return { n: t.n, seite: t.seite, eig: t.eig, runden };
  });
  // DUETT (Eiskunstlauf): je Seite nach eig sortiert, benachbarte Paare 80/20 fusioniert.
  if (art.duett) for (const seite of [0, 1]) {
    const g = T.filter((x) => x.seite === seite).sort((x, y) => y.eig - x.eig);
    for (let i = 0; i + 1 < g.length; i += 2) for (let r = 0; r < rundenN; r++) {
      const pa = g[i].runden[r], pb = g[i + 1].runden[r];
      g[i].runden[r] = Math.round(0.8 * pa + 0.2 * pb); g[i + 1].runden[r] = Math.round(0.8 * pb + 0.2 * pa);
    }
  }
  return T.map((t) => ({ n: t.n, eig: Math.round(t.eig * 100) / 100, wert: t.runden.reduce((a, b) => a + b, 0) }));
}

function messe(motor, varianten, R, opt) {
  const ausw = varianten.map((v) => ({ label: v.label, ...auswerten(v.spiele.map((s) => ({ teilnehmer: spieleSpiel(motor, s, R, opt) }))) }));
  return {
    spielMed: median(ausw.map((a) => a.spiel)), spielSpan: spannweite(ausw.map((a) => a.spiel)),
    spielMittel: ausw.reduce((a, b) => a + b.spiel, 0) / ausw.length,
    saisonMed: median(ausw.map((a) => a.saison)), saisonSpan: spannweite(ausw.map((a) => a.saison)), varianten: ausw,
  };
}

// Zerlegung: Validitaet = rho(Eignung, Erwartungswert ohne Wuerfel) je Spiel; dazu die
// Streuung des Erwartungswerts (Signal) gegen die binomiale Streuung der Wuerfe (Rauschen).
function zerlege(motor, varianten, R, opt = {}) {
  const art = motor.art; const rn = opt.rundenN || art.rundenN, fa = opt.failAbzug != null ? opt.failAbzug : art.failAbzug;
  let val = 0, sig = 0, noise = 0, k = 0;
  for (const v of varianten) for (const s of v.spiele) {
    const rows = s.teilnehmer.map((t) => {
      const L = {}; for (const kk in R) L[kk] = mische(t.attr, R[kk]);
      let e = 0, va = 0;
      for (let ri = 0; ri < rn; ri++) {
        const erm = 1 - Math.max(0, 60 - L.AUSDAUER) * 0.0035 * (ri / Math.max(1, rn - 1));
        const basis = (20 + L.GRUNDLAGE * 0.7) * Math.max(0.4, erm);
        const p = Math.min(0.94, 0.15 + L.TECHNIK * 0.0055 + L.NERVEN * 0.0035);
        const swing = basis * (1 - fa) + L.SPITZENMOMENT * 0.35 * (0.4 + L.WAGNIS * 0.006);
        e += basis * fa + p * swing + L.PUBLIKUM * 0.12; va += p * (1 - p) * swing * swing;
      }
      return { eig: t.eig, wert: e, va };
    });
    val += rho(rows); const m = rows.reduce((a, r) => a + r.wert, 0) / rows.length;
    sig += Math.sqrt(rows.reduce((a, r) => a + (r.wert - m) ** 2, 0) / rows.length);
    noise += Math.sqrt(rows.reduce((a, r) => a + r.va, 0) / rows.length); k++;
  }
  return { validitaet: val / k, signal: sig / k, rauschen: noise / k };
}

// Mechanisches Gewicht der Rollen (Sondierung ohne Browser): jede Rolle fuer alle Teilnehmer
// um +10 anheben, mittleren Gewinn am Erwartungswert messen, auf 100 normieren.
function sondiere(motor, varianten, R) {
  const art = motor.art; const rn = art.rundenN, fa = art.failAbzug;
  const erwartung = (L) => { let e = 0; for (let ri = 0; ri < rn; ri++) { const erm = 1 - Math.max(0, 60 - L.AUSDAUER) * 0.0035 * (ri / Math.max(1, rn - 1)); const basis = (20 + L.GRUNDLAGE * 0.7) * Math.max(0.4, erm); const p = Math.min(0.94, 0.15 + L.TECHNIK * 0.0055 + L.NERVEN * 0.0035); e += basis * fa + p * (basis * (1 - fa) + L.SPITZENMOMENT * 0.35 * (0.4 + L.WAGNIS * 0.006)) + L.PUBLIKUM * 0.12; } return e; };
  const gewinn = {}; for (const k in R) gewinn[k] = 0; let n = 0;
  for (const v of varianten) for (const s of v.spiele.slice(0, 4)) for (const t of s.teilnehmer) {
    const L = {}; for (const k in R) L[k] = mische(t.attr, R[k]); const e0 = erwartung(L);
    for (const k in R) { const L2 = { ...L, [k]: Math.min(99, L[k] + 10) }; gewinn[k] += Math.max(0, erwartung(L2) - e0); } n++;
  }
  const summe = Object.values(gewinn).reduce((a, b) => a + b, 0) || 1;
  const out = {}; for (const k in gewinn) out[k] = (100 * gewinn[k]) / summe; return out;
}

// ---------------------------------------------------------------------------------
// Kader: die offizielle Familie plus deterministische Mischkader aus denselben Spielern
// ---------------------------------------------------------------------------------
function ladeFamilie() {
  const geladen = ladeKaderFamilieAusDatei(KADERFAMILIE_PFAD);
  if (!geladen) throw new Error(`Kaderfamilie fehlt: ${KADERFAMILIE_PFAD} (s. scripts/ziehe-kader-familie.ts).`);
  return geladen;
}
function mischFamilie(familie, saat, k, jeSeite) {
  const alle = new Map(); for (const v of familie) for (const s of ["heim", "gast"]) for (const p of v[s]) alle.set(p.n, p);
  const pool = [...alle.values()];
  let z = saat; const rnd = () => { z = (Math.imul(z, 1103515245) + 12345) & 0x7fffffff; return (z >>> 16) / 32768; };
  const out = [];
  for (let q = 0; q < k; q++) {
    const m = [...pool]; for (let i = m.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [m[i], m[j]] = [m[j], m[i]]; }
    out.push({ label: `misch-${saat}-${q}`, heim: m.slice(0, jeSeite), gast: m.slice(jeSeite, 2 * jeSeite) });
  }
  return out;
}

// ---------------------------------------------------------------------------------
// Suche: deterministischer Bergsteiger in 5-Punkt-Schritten, Semantik-Schranke, mehrere
// Startpunkte (Ist-Rezept, Matrix-in-jeder-Rolle). Ziel ist das MITTEL (nicht der Median)
// ueber 13 Kader — der Median ueber fuenf springt mit der mittleren Variante.
// ---------------------------------------------------------------------------------
const klon = (R) => { const o = {}; for (const k in R) o[k] = { ...R[k] }; return o; };
function suche(motor, zielSet, start, erlaubt, schritte, saat, opt, maxAttr = 4) {
  const rollen = Object.keys(start), attrs = Object.keys(motor.matrix);
  let z = saat; const rnd = () => { z = (Math.imul(z, 1103515245) + 12345) & 0x7fffffff; return (z >>> 16) / 32768; };
  const ziel = (R) => messe(motor, zielSet, R, opt).spielMittel;
  const nachbar = (R) => {
    const N = klon(R); const rolle = rollen[Math.floor(rnd() * rollen.length)]; const r = N[rolle];
    const keys = Object.keys(r); const von = keys[Math.floor(rnd() * keys.length)];
    const kand = (erlaubt && erlaubt[rolle]) || attrs;
    const nach = (rnd() < 0.6 || keys.length >= maxAttr) ? keys[Math.floor(rnd() * keys.length)] : kand[Math.floor(rnd() * kand.length)];
    if (nach === von || !kand.includes(nach)) return null;
    const s = Math.min(5 * (1 + Math.floor(rnd() * 3)), r[von]); r[von] -= s; r[nach] = (r[nach] || 0) + s; if (r[von] <= 0) delete r[von];
    return N;
  };
  let R = klon(start), best = ziel(R);
  for (let i = 0; i < schritte; i++) { const N = nachbar(R); if (!N) continue; const v = ziel(N); if (v > best + 1e-9) { best = v; R = N; } }
  return { R, best };
}
// Glaettung: Posten unter 10 % streichen, wenn es das Ziel um weniger als 0,002 kostet.
function glaette(motor, zielSet, R, opt) {
  const ziel = (X) => messe(motor, zielSet, X, opt).spielMittel;
  let akt = klon(R), best = ziel(akt);
  for (const rolle of Object.keys(akt)) for (const a of Object.keys(akt[rolle])) {
    if (akt[rolle][a] >= 10 || Object.keys(akt[rolle]).length <= 1) continue;
    const N = klon(akt); const rest = N[rolle][a]; delete N[rolle][a];
    const groesster = Object.keys(N[rolle]).sort((x, y) => N[rolle][y] - N[rolle][x])[0]; N[rolle][groesster] += rest;
    const v = ziel(N); if (v >= best - 0.002) { akt = N; best = v; }
  }
  return akt;
}
const rezeptBlock = (d, R) => `      rezept:{\n` + Object.keys(R).map((k) => `        ${(k + ":").padEnd(14)}{${Object.entries(R[k]).sort((x, y) => y[1] - x[1]).map(([a, v]) => `${a}:${v}`).join(",")}}`).join(",\n") + `\n      }`;

// ---------------------------------------------------------------------------------
// Echte Motor-Messung (Playwright) einer Mockup-Kopie mit eingesetztem Rezept/rundenN.
// ---------------------------------------------------------------------------------
async function motorMessung(engineQuelle, motor, R, opt, familie, n) {
  const { chromium } = await import("playwright");
  const ordner = mkdtempSync(path.join(tmpdir(), "buehne-kalib-"));
  try {
    for (const f of ["battle-mode.html", "battle-mode.rezepte.js"]) copyFileSync(path.join(MOCKUP, f), path.join(ordner, f));
    // Nur der BUEHNE_ART-Eintrag dieser Disziplin wird in der Kopie umgeschrieben: Rezeptblock,
    // auf Wunsch rundenN (rundenDauer wird wie bei Eiskunstlauf/Breaking so nachgezogen, dass
    // die Gesamtdauer von ~60 s bleibt) und failAbzug. Alles andere bleibt Zeichen fuer Zeichen.
    let eintrag = motor.eintrag;
    if (R) eintrag = eintrag.replace(motor.rezeptTextOrig, "{\n" + Object.keys(R).map((k) => `        ${k}:{${Object.entries(R[k]).map(([a, v]) => `${a}:${v}`).join(",")}}`).join(",\n") + "\n      }");
    // NUR CODEZEILEN anfassen, keine Kommentarzeilen: die Kommentare ueber dem Fechten-Eintrag
    // enthalten selbst "rundenN:12 bzw. rundenN:8" — ein naives replace() traf zuerst den
    // Kommentar, und die Kopie lief unveraendert mit rundenN 9 (beim ersten Lauf dieses
    // Skripts genau so passiert: "Echter Motor" bit-identisch zum Ist-Stand trotz --rundenN 18).
    const nurCode = (text, fn) => text.split("\n").map((z) => (z.trim().startsWith("//") ? z : fn(z))).join("\n");
    if (opt.rundenN) eintrag = nurCode(eintrag, (z) => z.replace(/\brundenN:\s*[0-9]+/, `rundenN:${opt.rundenN}`).replace(/\brundenDauer:\s*[0-9.]+(?:\/\([^)]*\))?/, `rundenDauer:${60 / (opt.rundenN * motor.art.jeSeite * 2)}`));
    if (opt.failAbzug != null) eintrag = nurCode(eintrag, (z) => z.replace(/\bfailAbzug:\s*[0-9.]+/, `failAbzug:${opt.failAbzug}`));
    if ((opt.rundenN && !/\n\s*label:[^\n]*rundenN:/.test(eintrag.replace(new RegExp(`rundenN:${opt.rundenN}`), "rundenN:"))) === true) throw new Error("rundenN konnte in der Kopie nicht gesetzt werden.");
    const quelle = engineQuelle.replace(motor.eintrag, () => eintrag);
    writeFileSync(path.join(ordner, "battle-mode.engine.js"), quelle, "utf8");
    const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
    const browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
    try {
      const seite = await browser.newPage(); const fehler = [];
      seite.on("pageerror", (e) => fehler.push(String(e)));
      await seite.goto(pathToFileURL(path.join(ordner, "battle-mode.html")).href, { waitUntil: "networkidle" });
      await seite.waitForFunction(() => window.__arena && window.__arena.disziplinProbe, null, { timeout: 30000 });
      const x = await seite.evaluate(([d, n, f]) => window.__arena.disziplinProbe(d, { n, kaderFamilie: f }), [DISZIPLIN, n, familie]);
      if (fehler.length) console.log("Seitenfehler: " + fehler.slice(0, 3).join(" | "));
      return x;
    } finally { await browser.close(); }
  } finally { rmSync(ordner, { recursive: true, force: true }); }
}
const fasseZusammen = (x) => {
  const ausw = x.varianten.map((v) => ({ label: v.label, ...auswerten(v.spiele) }));
  return { spielMed: median(ausw.map((a) => a.spiel)), spielSpan: spannweite(ausw.map((a) => a.spiel)), spielMittel: ausw.reduce((a, b) => a + b.spiel, 0) / ausw.length, saisonMed: median(ausw.map((a) => a.saison)), saisonSpan: spannweite(ausw.map((a) => a.saison)), varianten: ausw };
};
const zeile = (name, m) => `${name.padEnd(26)} rho/Spiel Median ${m.spielMed.toFixed(3)}  Mittel ${m.spielMittel.toFixed(3)}  Spannweite ${m.spielSpan.toFixed(3)} | Saison ${m.saisonMed.toFixed(3)} (${m.saisonSpan.toFixed(3)}) | je Variante ${m.varianten.map((v) => v.spiel.toFixed(3)).join(" ")}`;

// ---------------------------------------------------------------------------------
// Hauptprogramm
// ---------------------------------------------------------------------------------
const engineQuelle = readFileSync(path.join(MOCKUP, "battle-mode.engine.js"), "utf8");
const motor = liesMotor(engineQuelle, DISZIPLIN);
const { familie, quelle } = ladeFamilie();
const opt = {}; if (RUNDEN_N_ARG) opt.rundenN = Number(RUNDEN_N_ARG);
const OFFIZIELL = familie.map((v) => bereiteVariante(motor, DISZIPLIN, v, SPIELE));
const R0 = motor.art.rezept;

console.log(`${DISZIPLIN} — Buehne, rundenN ${motor.art.rundenN}${opt.rundenN ? ` (gemessen mit ${opt.rundenN})` : ""}, failAbzug ${motor.art.failAbzug}, jeSeite ${motor.art.jeSeite}${motor.art.duell ? ", duell" : ""}${motor.art.duett ? ", duett" : ""}`);
console.log(`Kader-Quelle: ${quelle}, ${SPIELE} Spiele je Variante\n`);

if (hat("--vergleich")) {
  const nach = messe(motor, OFFIZIELL, R0);
  const x = await motorMessung(engineQuelle, motor, null, {}, familie, SPIELE);
  const echt = fasseZusammen(x);
  let abw = 0, k = 0;
  x.varianten.forEach((v, vi) => v.spiele.forEach((s, si) => { const m = spieleSpiel(motor, OFFIZIELL[vi].spiele[si], R0); s.teilnehmer.forEach((t, ti) => { abw += Math.abs(t.wert - (m[ti] && m[ti].n === t.n ? m[ti].wert : 1e9)) + Math.abs(t.eig - (m[ti] ? m[ti].eig : 1e9)); k++; }); }));
  console.log(zeile("Nachbildung", nach)); console.log(zeile("Echter Motor", echt));
  console.log(`\n${k} Teilnehmer verglichen, Summe der Abweichungen (eig+wert): ${abw.toFixed(3)} — ${abw === 0 ? "BIT-IDENTISCH" : "ABWEICHUNG, Nachbildung nicht vertrauenswuerdig"}`);
  process.exit(abw === 0 ? 0 : 1);
}

if (hat("--pruefe")) {
  const datei = wert("--pruefe", null);
  const R = datei && !datei.startsWith("--") ? JSON.parse(readFileSync(datei, "utf8")) : R0;
  console.log(`Echte Motor-Messung${datei ? ` von ${datei}` : " des Ist-Rezepts"}${opt.rundenN ? `, rundenN ${opt.rundenN}` : ""}:`);
  console.log(zeile("Nachbildung", messe(motor, OFFIZIELL, R, opt)));
  console.log(zeile("Echter Motor", fasseZusammen(await motorMessung(engineQuelle, motor, datei ? R : null, opt, familie, SPIELE))));
  process.exit(0);
}

// Ist-Stand
const ist = messe(motor, OFFIZIELL, R0, opt);
console.log(zeile("IST (Nachbildung)", ist));
const zl = zerlege(motor, OFFIZIELL, R0, opt);
console.log(`Zerlegung: Validitaet (ohne Wuerfel) ${zl.validitaet.toFixed(3)} · Signal-SD ${zl.signal.toFixed(1)} · Rausch-SD ${zl.rauschen.toFixed(1)}`);
const ALLES = {}; for (const k of Object.keys(R0)) ALLES[k] = { ...motor.matrix };
const zlM = zerlege(motor, OFFIZIELL, ALLES, opt);
console.log(`Vergleich Matrix-in-jeder-Rolle: rho/Spiel ${messe(motor, OFFIZIELL, ALLES, opt).spielMed.toFixed(3)} · Validitaet ${zlM.validitaet.toFixed(3)} · Signal-SD ${zlM.signal.toFixed(1)} (Validitaets-Decke dieses Chassis)`);
const mech = sondiere(motor, OFFIZIELL, R0);
console.log("Mechanisches Gewicht der Rollen: " + Object.entries(mech).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v.toFixed(1)} %`).join(" · "));
for (const rn of [motor.art.rundenN, 12, 18].filter((v, i, a) => a.indexOf(v) === i)) console.log(zeile(`IST bei rundenN ${rn}`, messe(motor, OFFIZIELL, R0, { rundenN: rn })));

if (hat("--suche")) {
  const schritte = Number(wert("--suche", 3000)) || 3000;
  const erlaubt = hat("--frei") ? null : ERLAUBT[DISZIPLIN] || null;
  const jeSeite = motor.art.jeSeite;
  const MISCH = mischFamilie(familie, 4711, 8, jeSeite).map((v) => bereiteVariante(motor, DISZIPLIN, v, SPIELE, { saat0: 777, formSaat0: 20280101 }));
  const ZIELSET = [...OFFIZIELL, ...MISCH];
  const TEST_SAATEN = familie.map((v) => bereiteVariante(motor, DISZIPLIN, v, 48, { saat0: 424242, formSaat0: 20270101 }));
  const TEST_KADER = mischFamilie(familie, 9001, 8, jeSeite).map((v) => bereiteVariante(motor, DISZIPLIN, v, 48, { saat0: 31337, formSaat0: 20290101 }));
  console.log(`\nSUCHE: ${schritte} Schritte je Start, Ziel = Mittel rho/Spiel ueber ${ZIELSET.length} Kader (5 offiziell + 8 Mischkader), ${erlaubt ? "MIT" : "OHNE"} Semantik-Schranke${opt.rundenN ? `, rundenN ${opt.rundenN}` : ""}`);
  const starts = [["Ist-Rezept", R0, 101], ["Matrix-in-jeder-Rolle", ALLES, 202], ["Ist-Rezept, zweite Saat", R0, 303]];
  let bestes = null;
  for (const [name, start, saat] of starts) {
    const t0 = Date.now();
    const { R, best } = suche(motor, ZIELSET, start, erlaubt, schritte, saat, opt);
    const G = glaette(motor, ZIELSET, R, opt); const bestG = messe(motor, ZIELSET, G, opt).spielMittel;
    console.log(`\nStart ${name} (${((Date.now() - t0) / 1000).toFixed(0)} s): Zielwert ${best.toFixed(4)}, geglaettet ${bestG.toFixed(4)}`);
    console.log(zeile("  offiziell (5 Kader)", messe(motor, OFFIZIELL, G, opt)));
    console.log(zeile("  held-out Saaten", messe(motor, TEST_SAATEN, G, opt)));
    console.log(zeile("  held-out Mischkader", messe(motor, TEST_KADER, G, opt)));
    if (!bestes || bestG > bestes.best) bestes = { R: G, best: bestG, name };
  }
  const zb = zerlege(motor, OFFIZIELL, bestes.R, opt);
  console.log(`\n=== BESTES (Start ${bestes.name}, Zielwert ${bestes.best.toFixed(4)}) — Validitaet ${zb.validitaet.toFixed(3)} · Signal-SD ${zb.signal.toFixed(1)} · Rausch-SD ${zb.rauschen.toFixed(1)} ===`);
  console.log(rezeptBlock(DISZIPLIN, bestes.R));
  for (const rn of [motor.art.rundenN, 12, 18].filter((v, i, a) => a.indexOf(v) === i)) {
    console.log(zeile(`  offiziell, rundenN ${rn}`, messe(motor, OFFIZIELL, bestes.R, { rundenN: rn })));
    console.log(zeile(`  held-out Saaten, rN ${rn}`, messe(motor, TEST_SAATEN, bestes.R, { rundenN: rn })));
    console.log(zeile(`  held-out Kader, rN ${rn}`, messe(motor, TEST_KADER, bestes.R, { rundenN: rn })));
  }
  const ziel = wert("--schreibe", null);
  if (ziel && !ziel.startsWith("--")) { writeFileSync(ziel, JSON.stringify(bestes.R, null, 2) + "\n"); console.log(`\nRezept geschrieben nach ${ziel} — echte Motor-Messung: node scripts/kalibriere-buehne-rezept.mjs ${DISZIPLIN} --pruefe ${ziel}${opt.rundenN ? ` --rundenN ${opt.rundenN}` : ""}`); }
}
