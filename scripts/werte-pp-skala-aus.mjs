#!/usr/bin/env node
// ===================================================================================
// AUSWERTUNG DER PP-SKALA-SONDE (18.11., docs/design/pp-skala-18-11.md).
//
// Liest einen oder mehrere JSON-Abzuege von scripts/miss-pp-skala.ts und druckt je Disziplin die
// Verteilung der Spieler-PP je "Zelle" (= Liga x Spieltag x Disziplin, also alle Duelle bzw. Pods
// einer Liga an einem Spieltag): Maximum, Top-3, Median, Minimum. Dazu offline die Varianten aus
// dem Dokument (Abschnitt 4) und die Rangpruefung (Spearman Eignung->PP je Zelle, vorher/nachher).
//
//   node scripts/werte-pp-skala-aus.mjs <abzug.json> [weitere.json ...]
//   node scripts/werte-pp-skala-aus.mjs --schreibe-kalibrierung <abzug.json> [weitere.json ...]
//       schreibt data/generated/pp-skala-kalibrierung.json (Faktor k_d = ZIEL / Median der Tagesbesten)
// ===================================================================================
import { readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const schreibe = args.includes("--schreibe-kalibrierung");
const dateien = args.filter((a) => !a.startsWith("--"));
// --kalibrierung=<datei>: feste Anker (z. B. data/generated/pp-skala-kalibrierung.json) statt sie aus den
// uebergebenen Abzuegen neu zu ziehen -- fuer die Pruefung AUSSERHALB der Stichprobe.
const festeKalibrierung = args.find((a) => a.startsWith("--kalibrierung="))?.slice("--kalibrierung=".length) ?? null;
if (dateien.length === 0) {
  console.error("Aufruf: node scripts/werte-pp-skala-aus.mjs [--schreibe-kalibrierung] <abzug.json> [...]");
  process.exit(1);
}

const PP_SKALA_ZIEL = 5;
const MIN_ZELLEN_JE_FELD = 2;

const zeilen = [];
const quellen = [];
for (const [nr, datei] of dateien.entries()) {
  const j = JSON.parse(readFileSync(datei, "utf8"));
  quellen.push({ datei, saveId: j.saveId, gespielt: j.gespielt, ppSkala: j.ppSkala, erstellt: j.erstellt });
  for (const z of j.zeilen) zeilen.push({ ...z, lauf: nr, roh: j.ppSkala === "roh" });
}

const q = (sortiert, p) => {
  if (sortiert.length === 0) return 0;
  const i = (sortiert.length - 1) * p;
  const u = Math.floor(i);
  const o = Math.ceil(i);
  return u === o ? sortiert[u] : sortiert[u] * (1 - (i - u)) + sortiert[o] * (i - u);
};
const f2 = (x) => (Number.isFinite(x) ? x.toFixed(2).replace(".", ",") : "–");
const f3 = (x) => (Number.isFinite(x) ? x.toFixed(3).replace(".", ",") : "–");

function raenge(werte) {
  const idx = werte.map((w, i) => [w, i]).sort((a, b) => a[0] - b[0]);
  const r = new Array(werte.length);
  let i = 0;
  while (i < idx.length) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
    for (let k = i; k <= j; k++) r[idx[k][1]] = (i + j) / 2;
    i = j + 1;
  }
  return r;
}
function spearman(a, b) {
  if (a.length < 3) return NaN;
  const ra = raenge(a);
  const rb = raenge(b);
  const m = (ra.length - 1) / 2;
  let sab = 0;
  let saa = 0;
  let sbb = 0;
  for (let i = 0; i < ra.length; i++) {
    sab += (ra[i] - m) * (rb[i] - m);
    saa += (ra[i] - m) ** 2;
    sbb += (rb[i] - m) ** 2;
  }
  return saa > 0 && sbb > 0 ? sab / Math.sqrt(saa * sbb) : NaN;
}

// Zellen bilden: Lauf x Liga x Spieltag x Disziplin.
const zellen = new Map();
for (const z of zeilen) {
  const k = `${z.lauf}|${z.liga}|${z.md}|${z.d}`;
  if (!zellen.has(k)) zellen.set(k, { lauf: z.lauf, roh: z.roh, liga: z.liga, md: z.md, d: z.d, zeilen: [] });
  zellen.get(k).zeilen.push(z);
}

// FELDGROESSE je Zelle: die haeufigste Zahl an Einsaetzen je Team-Seite (= Spieler je Team in dieser
// Disziplin an diesem Spieltag; ein unterbesetztes Team zaehlt nicht dagegen).
for (const zelle of zellen.values()) {
  const jeSeite = new Map();
  for (const z of zelle.zeilen) {
    const k = `${z.team}|${z.seite}`;
    jeSeite.set(k, (jeSeite.get(k) ?? 0) + 1);
  }
  const haeufigkeit = new Map();
  for (const n of jeSeite.values()) haeufigkeit.set(n, (haeufigkeit.get(n) ?? 0) + 1);
  zelle.feld = [...haeufigkeit].sort((x, y) => y[1] - x[1] || y[0] - x[0])[0]?.[0] ?? null;
}

const jeDisziplin = new Map();
for (const zelle of zellen.values()) {
  if (!jeDisziplin.has(zelle.d)) jeDisziplin.set(zelle.d, []);
  jeDisziplin.get(zelle.d).push(zelle);
}

// ---- IST ----
console.log(`Quellen: ${quellen.map((x) => `${x.datei} (${x.gespielt} Spieltage, PP-Skala ${x.ppSkala})`).join("; ")}`);
console.log(`${zeilen.length} PP-Zeilen, ${zellen.size} Zellen (Liga x Spieltag x Disziplin)\n`);
console.log("## IST je Disziplin (Werte = Median ueber die Zellen; Max-Spanne = kleinstes..groesstes Zellen-Maximum)\n");
console.log("| Disziplin | Quelle | Zellen | Spieler/Zelle | Max (Median) | Max-Spanne | Top-3-Mittel | Median | Minimum | Anteil Zellen mit Top >= 5,4 |");
console.log("|---|---|---:|---:|---:|---|---:|---:|---:|---:|");
const kalibrierung = {};
const tabelle = [];
for (const [d, liste] of [...jeDisziplin].sort((a, b) => a[0].localeCompare(b[0]))) {
  const maxe = [];
  const top3 = [];
  const mediane = [];
  const minima = [];
  const groesse = [];
  let gedeckelt = 0;
  const quellenD = new Set();
  for (const zelle of liste) {
    const pp = zelle.zeilen.map((z) => z.pp).sort((a, b) => b - a);
    zelle.zeilen.forEach((z) => quellenD.add(z.quelle.replace("battle_mode_", "").replace("_player_score", "")));
    maxe.push(pp[0]);
    top3.push((pp[0] + (pp[1] ?? pp[0]) + (pp[2] ?? pp[0])) / 3);
    mediane.push(q([...pp].reverse(), 0.5));
    minima.push(pp[pp.length - 1]);
    groesse.push(pp.length);
    if (pp[0] >= 5.4) gedeckelt += 1;
  }
  const s = (a) => [...a].sort((x, y) => x - y);
  const medMax = q(s(maxe), 0.5);
  tabelle.push({ d, medMax, minMax: Math.min(...maxe), maxMax: Math.max(...maxe) });
  // KALIBRIERUNG (Variante C): Median der UNGEDECKELTEN Tagesbesten. Zellen aus einem Lauf ohne
  // `OLY_PP_SKALA=roh`, deren Bester am alten Deckel 5,5 klebt, sind zensiert (wahrer Wert >= 5,5) und
  // zaehlen als +unendlich; genommen wird der UNTERE Median, damit eine zensierte Mitte auf 5,5 faellt.
  const kandidaten = liste
    .map((zelle) => {
      const m = Math.max(...zelle.zeilen.map((z) => z.pp));
      return !zelle.roh && m >= 5.49 ? Infinity : m;
    })
    .sort((a, b) => a - b);
  // Mit mindestens 4 roh-Zellen nur die roh-Zellen (ungedeckelt, keine Zensur), sonst gemischt.
  const rohMaxe = liste.filter((zelle) => zelle.roh).map((zelle) => Math.max(...zelle.zeilen.map((z) => z.pp))).sort((a, b) => a - b);
  const basisKandidaten = rohMaxe.length >= 4 ? rohMaxe : kandidaten;
  const unterer = basisKandidaten[Math.floor((basisKandidaten.length - 1) / 2)];
  // R_med: Median ALLER Einsaetze der Disziplin (weit unter dem alten Deckel, aus allen Laeufen gueltig).
  const alleEinsaetze = liste.flatMap((zelle) => zelle.zeilen.map((z) => z.pp)).sort((a, b) => a - b);
  const rMed = q(alleEinsaetze, 0.5);
  const kalibMax = Number.isFinite(unterer) ? unterer : 5.5;
  // ANKER JE FELDGROESSE (18.11., Scharfschaltung): dieselbe Regel je (Disziplin, Feldgroesse), sobald
  // mindestens MIN_ZELLEN_JE_FELD ungedeckelte (roh-)Zellen dieser Feldgroesse vorliegen. Sonst gilt fuer
  // diese Feldgroesse der Disziplin-weite Anker (lib/resolve/pp-skala.ts, `ppSkalaAnker()`).
  const feldgroessen = {};
  const felder = [...new Set(liste.map((zelle) => zelle.feld).filter((n) => n != null))].sort((x, y) => x - y);
  for (const n of felder) {
    const zellenN = liste.filter((zelle) => zelle.feld === n);
    const rohN = zellenN.filter((zelle) => zelle.roh).map((zelle) => Math.max(...zelle.zeilen.map((z) => z.pp))).sort((x, y) => x - y);
    if (rohN.length < MIN_ZELLEN_JE_FELD) continue;
    const rTopN = rohN[Math.floor((rohN.length - 1) / 2)];
    const einsaetzeN = zellenN.flatMap((zelle) => zelle.zeilen.map((z) => z.pp)).sort((x, y) => x - y);
    const rMedN = q(einsaetzeN, 0.5);
    if (!(rTopN > rMedN) || !(rMedN > 0)) continue;
    feldgroessen[String(n)] = { rTop: Number(rTopN.toFixed(4)), rMed: Number(rMedN.toFixed(4)), zellen: rohN.length };
  }
  kalibrierung[d] = {
    ...(Object.keys(feldgroessen).length > 0 ? { feldgroessen } : {}),
    rTop: Number(kalibMax.toFixed(4)),
    rMed: Number(rMed.toFixed(4)),
    faktor: Number((PP_SKALA_ZIEL / kalibMax).toFixed(4)),
    medianTagesbester: Number(kalibMax.toFixed(3)),
    zellen: liste.length,
    zellenRoh: liste.filter((zelle) => zelle.roh).length,
    zensiert: kandidaten.filter((x) => !Number.isFinite(x)).length,
  };
  console.log(
    `| ${d} | ${[...quellenD].join("/")} | ${liste.length} | ${f2(q(s(groesse), 0.5))} | ${f2(medMax)} | ${f2(Math.min(...maxe))}..${f2(Math.max(...maxe))} | ${f2(q(s(top3), 0.5))} | ${f2(q(s(mediane), 0.5))} | ${f2(q(s(minima), 0.5))} | ${Math.round((100 * gedeckelt) / liste.length)} % |`,
  );
}
const alleMax = tabelle.map((t) => t.medMax).sort((a, b) => a - b);
console.log(
  `\nSpannweite der Tagesbesten (Median je Disziplin) ueber ${tabelle.length} Disziplinen: ${f2(alleMax[0])} .. ${f2(alleMax[alleMax.length - 1])}` +
    ` (niedrigste: ${tabelle.find((t) => t.medMax === alleMax[0]).d}, hoechste: ${tabelle.find((t) => t.medMax === alleMax[alleMax.length - 1]).d})`,
);

// ---- Saisonsummen (Spieler) ----
const summe = new Map();
for (const z of zeilen) {
  const k = `${z.lauf}|${z.spieler}`;
  summe.set(k, (summe.get(k) ?? 0) + z.pp);
}
const summen = [...summe.values()].sort((a, b) => b - a);
console.log(
  `Saisonsumme Spieler-PP (alle Laeufe): Max ${f2(summen[0])}, Top-10-Mittel ${f2(summen.slice(0, 10).reduce((a, b) => a + b, 0) / Math.min(10, summen.length))}, Median ${f2(q([...summen].reverse(), 0.5))}`,
);

if (festeKalibrierung) {
  const fest = JSON.parse(readFileSync(festeKalibrierung, "utf8")).disziplinen ?? {};
  for (const [d, e] of Object.entries(fest)) {
    kalibrierung[d] = { ...(kalibrierung[d] ?? {}), rTop: e.rTop, rMed: e.rMed, faktor: e.faktor, medianTagesbester: e.medianTagesbester, feldgroessen: e.feldgroessen };
  }
  console.log(`\n(Anker fest aus ${festeKalibrierung}, nicht aus diesen Abzuegen gezogen)`);
}

// C2: Zwei-Anker-Nachkalibrierung (der Prototyp) auf dem UNGEDECKELTEN alten Wert.
const C2_ANTEIL_MITTE = 0.25;
function c2(d, roh, feld = null) {
  const jeFeld = feld != null ? kalibrierung[d].feldgroessen?.[String(feld)] : null;
  const { rTop, rMed } = jeFeld ?? kalibrierung[d];
  if (!(rMed > 0) || !(rTop > rMed)) return Math.round(Math.min(PP_SKALA_ZIEL, Math.max(0, roh)) * 100) / 100;
  const e = Math.log(C2_ANTEIL_MITTE) / Math.log(rMed / rTop);
  const neu = roh <= 0 ? 0 : PP_SKALA_ZIEL * Math.pow(roh / rTop, e);
  return Math.round(Math.min(PP_SKALA_ZIEL, neu) * 100) / 100;
}

// ---- Varianten offline ----
function variante(name, abbildung) {
  const maxJeD = new Map();
  const rhoVor = [];
  const rhoNach = [];
  let gleichstandNeu = 0;
  let paare = 0;
  let umgedreht = 0;
  for (const zelle of zellen.values()) {
    const vorher = zelle.zeilen.map((z) => z.pp);
    const nachher = abbildung(zelle);
    const eig = zelle.zeilen.map((z) => z.eignung);
    const rv = spearman(eig, vorher);
    const rn = spearman(eig, nachher);
    if (Number.isFinite(rv) && Number.isFinite(rn)) {
      rhoVor.push(rv);
      rhoNach.push(rn);
    }
    for (let i = 0; i < vorher.length; i++) {
      for (let j = i + 1; j < vorher.length; j++) {
        paare += 1;
        if (vorher[i] !== vorher[j] && nachher[i] === nachher[j]) gleichstandNeu += 1;
        if ((vorher[i] - vorher[j]) * (nachher[i] - nachher[j]) < 0) umgedreht += 1;
      }
    }
    if (!maxJeD.has(zelle.d)) maxJeD.set(zelle.d, []);
    maxJeD.get(zelle.d).push(Math.max(...nachher));
  }
  const medJeD = [...maxJeD].map(([d, m]) => [d, q(m.sort((a, b) => a - b), 0.5), Math.min(...m), Math.max(...m)]);
  const meds = medJeD.map((x) => x[1]).sort((a, b) => a - b);
  const mittel = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  console.log(
    `| ${name} | ${f2(meds[0])}..${f2(meds[meds.length - 1])} | ${f2(Math.min(...medJeD.map((x) => x[2])))}..${f2(Math.max(...medJeD.map((x) => x[3])))} | ${f3(mittel(rhoVor))} | ${f3(mittel(rhoNach))} | ${umgedreht} | ${gleichstandNeu} von ${paare} |`,
  );
}
console.log("\n## Varianten offline auf demselben Abzug\n");
console.log("| Variante | Tagesbester (Median je Disziplin), Spanne | Tagesbester, kleinstes..groesstes | rho Eignung->PP je Zelle vorher | nachher | Paare umgedreht | neue Gleichstaende |");
console.log("|---|---|---|---:|---:|---:|---:|");
variante("IST (unveraendert)", (zelle) => zelle.zeilen.map((z) => z.pp));
variante("A: nur Deckel 5,5 -> 5 (PP x 5/5,5)", (zelle) => zelle.zeilen.map((z) => Math.round((z.pp * 5) / 5.5 * 100) / 100));
variante("B: Tagesanker (5 x PP / Tagesbester)", (zelle) => {
  const m = Math.max(...zelle.zeilen.map((z) => z.pp));
  return zelle.zeilen.map((z) => (m > 0 ? Math.round(((PP_SKALA_ZIEL * z.pp) / m) * 100) / 100 : 0));
});
variante("C: Faktor je Disziplin, Deckel 5", (zelle) =>
  zelle.zeilen.map((z) => Math.round(Math.min(PP_SKALA_ZIEL, z.pp * kalibrierung[z.d].faktor) * 100) / 100),
);
variante("C2: Zwei-Anker je Feldgroesse, Deckel 5", (zelle) => zelle.zeilen.map((z) => c2(z.d, z.pp, zelle.feld)));
variante("D: Rangtabelle (5 fuer Rang 1, linear bis 0)", (zelle) => {
  const n = zelle.zeilen.length;
  const r = raenge(zelle.zeilen.map((z) => z.pp));
  return zelle.zeilen.map((_, i) => (n > 1 ? Math.round(((PP_SKALA_ZIEL * r[i]) / (n - 1)) * 100) / 100 : PP_SKALA_ZIEL));
});

console.log("\n## Kalibrierfaktor je Disziplin (Variante C)\n");
console.log("| Disziplin | R_top (Median Tagesbester, ungedeckelt) | R_med (Median-Einsatz) | C: Faktor k_d | C2: Exponent e | Zellen | davon roh | zensiert |");
console.log("|---|---:|---:|---:|---:|---:|---:|---:|");
for (const [d, k] of Object.entries(kalibrierung).sort((a, b) => a[0].localeCompare(b[0]))) {
  const e = Math.log(C2_ANTEIL_MITTE) / Math.log(k.rMed / k.rTop);
  console.log(`| ${d} | ${f2(k.rTop)} | ${f2(k.rMed)} | ${f3(k.faktor)} | ${f3(e)} | ${k.zellen} | ${k.zellenRoh} | ${k.zensiert} |`);
}

// ---- Variante C EXAKT je Disziplin, nur auf roh-Zellen (dort ist der Wert ungedeckelt) ----
const rohZellen = [...zellen.values()].filter((zelle) => zelle.roh);
if (rohZellen.length > 0) {
  console.log("\n## Varianten C und C2 exakt auf den roh-Zellen (alt = min(5,5, roh); C = min(5, k_d x roh); C2 = Zwei-Anker)\n");
  console.log("| Disziplin | Zellen | Tagesbester alt | alt am Deckel je Zelle | Median-Einsatz alt | C: Tagesbester | C: Median-Einsatz | C2: Tagesbester (Median, Spanne) | C2 am Deckel je Zelle | C2: Top-3-Mittel | C2: Median-Einsatz |");
  console.log("|---|---:|---:|---|---:|---:|---:|---|---|---:|---:|");
  const jeD = new Map();
  for (const zelle of rohZellen) {
    if (!jeD.has(zelle.d)) jeD.set(zelle.d, []);
    jeD.get(zelle.d).push(zelle);
  }
  for (const [d, liste] of [...jeD].sort((a, b) => a[0].localeCompare(b[0]))) {
    const k = kalibrierung[d].faktor;
    const altMax = [];
    const neuMax = [];
    const altDeckel = [];
    const neuDeckel = [];
    const altMed = [];
    const neuMed = [];
    const c2Max = [];
    const c2Deckel = [];
    const c2Top3 = [];
    const c2Med = [];
    for (const zelle of liste) {
      const roh = zelle.zeilen.map((z) => z.pp);
      const alt = roh.map((x) => Math.min(5.5, x));
      const neu = roh.map((x) => Math.round(Math.min(PP_SKALA_ZIEL, x * k) * 100) / 100);
      altMax.push(Math.max(...alt));
      neuMax.push(Math.max(...neu));
      altDeckel.push(alt.filter((x) => x >= 5.5).length);
      neuDeckel.push(neu.filter((x) => x >= PP_SKALA_ZIEL).length);
      altMed.push(q([...alt].sort((a, b) => a - b), 0.5));
      neuMed.push(q([...neu].sort((a, b) => a - b), 0.5));
      const zwei = roh.map((x) => c2(d, x, zelle.feld)).sort((a, b) => b - a);
      c2Max.push(zwei[0]);
      c2Deckel.push(zwei.filter((x) => x >= PP_SKALA_ZIEL).length);
      c2Top3.push((zwei[0] + (zwei[1] ?? zwei[0]) + (zwei[2] ?? zwei[0])) / 3);
      c2Med.push(q([...zwei].reverse(), 0.5));
    }
    const s = (a) => [...a].sort((x, y) => x - y);
    console.log(
      `| ${d} | ${liste.length} | ${f2(q(s(altMax), 0.5))} | ${altDeckel.join(",")} | ${f2(q(s(altMed), 0.5))} | ${f2(q(s(neuMax), 0.5))} | ${f2(q(s(neuMed), 0.5))} | ${f2(q(s(c2Max), 0.5))} (${f2(Math.min(...c2Max))}..${f2(Math.max(...c2Max))}) | ${c2Deckel.join(",")} | ${f2(q(s(c2Top3), 0.5))} | ${f2(q(s(c2Med), 0.5))} |`,
    );
  }
}

// ---- ABNEHMER MIT ABSOLUTEN SCHWELLEN (Abschnitt 8.3): Verhaeltnis C2 / alt, nur auf roh-Zellen ----
// alt = min(5,5; roh) (die heutige Kurve), neu = C2 mit den Ankern je Feldgroesse. Ein Faktor je Groesse:
// mittlerer Einsatz (organische Entwicklung `/30`), Median der Spieler-Saisonsummen (Trainings-XP `x 4`),
// Median der Team-Saisonsummen (Vorstands-Sportziel `>= 95`).
const umrechnung = (() => {
  const rohZ = [...zellen.values()].filter((zelle) => zelle.roh);
  if (rohZ.length === 0) return null;
  let altSumme = 0;
  let neuSumme = 0;
  let n = 0;
  const spieler = new Map();
  const teams = new Map();
  for (const zelle of rohZ) {
    for (const z of zelle.zeilen) {
      const alt = Math.min(5.5, z.pp);
      const neu = c2(z.d, z.pp, zelle.feld);
      altSumme += alt;
      neuSumme += neu;
      n += 1;
      const ks = `${zelle.lauf}|${z.spieler}`;
      const s0 = spieler.get(ks) ?? [0, 0];
      spieler.set(ks, [s0[0] + alt, s0[1] + neu]);
      const kt = `${zelle.lauf}|${z.team}`;
      const t0 = teams.get(kt) ?? [0, 0];
      teams.set(kt, [t0[0] + alt, t0[1] + neu]);
    }
  }
  const median = (werte) => q([...werte].sort((a, b) => a - b), 0.5);
  const sp = [...spieler.values()];
  const tm = [...teams.values()];
  const top = [...sp].sort((a, b) => b[0] - a[0]).slice(0, Math.max(1, Math.round(sp.length * 0.1)));
  const ergebnis = {
    einsatz: Number((neuSumme / altSumme).toFixed(4)),
    spielerSaison: Number((median(sp.map((x) => x[1])) / median(sp.map((x) => x[0]))).toFixed(4)),
    teamSaison: Number((median(tm.map((x) => x[1])) / median(tm.map((x) => x[0]))).toFixed(4)),
  };
  console.log("\n## Umrechnung fuer Abnehmer mit absoluten PP-Schwellen (C2 / alt, roh-Zellen)\n");
  console.log("| Groesse | alt | C2 | Faktor |");
  console.log("|---|---:|---:|---:|");
  console.log(`| mittlerer Einsatz (${n}) | ${f3(altSumme / n)} | ${f3(neuSumme / n)} | ${f3(ergebnis.einsatz)} |`);
  console.log(`| Spieler-Saisonsumme, Median (${sp.length}) | ${f2(median(sp.map((x) => x[0])))} | ${f2(median(sp.map((x) => x[1])))} | ${f3(ergebnis.spielerSaison)} |`);
  console.log(`| Spieler-Saisonsumme, oberste 10 % (Mittel) | ${f2(top.reduce((a, x) => a + x[0], 0) / top.length)} | ${f2(top.reduce((a, x) => a + x[1], 0) / top.length)} | ${f3(top.reduce((a, x) => a + x[1], 0) / top.reduce((a, x) => a + x[0], 0))} |`);
  console.log(`| Team-Saisonsumme, Median (${tm.length}) | ${f2(median(tm.map((x) => x[0])))} | ${f2(median(tm.map((x) => x[1])))} | ${f3(ergebnis.teamSaison)} |`);
  return ergebnis;
})();

// 22.11.: `--nur-battlefield[=orte3]` mischt NUR den Battlefield-Anker in die bestehende Datei (Laeufe im Format
// domination5, oder mit =orte3 im alten Format): `disziplinen.battlefield` gilt fuer das Standardformat, das alte
// steht unter `battlefieldOrte3` (beim ersten Mal vom bisherigen Eintrag uebernommen).
const nurBattlefield = args.find((a) => a === "--nur-battlefield" || a.startsWith("--nur-battlefield="));
if (nurBattlefield) {
  const ziel = new URL("../data/generated/pp-skala-kalibrierung.json", import.meta.url);
  const bestand = JSON.parse(readFileSync(ziel, "utf8"));
  const alt = nurBattlefield.endsWith("=orte3");
  if (!kalibrierung.battlefield) throw new Error("Keine Battlefield-Zellen in den Abzuegen.");
  if (!alt && bestand.disziplinen.battlefield && !bestand.disziplinen.battlefieldOrte3) bestand.disziplinen.battlefieldOrte3 = bestand.disziplinen.battlefield;
  bestand.disziplinen[alt ? "battlefieldOrte3" : "battlefield"] = kalibrierung.battlefield;
  bestand.battlefieldQuellen = { ...(bestand.battlefieldQuellen ?? {}), [alt ? "orte3" : "domination5"]: { gemessenAm: new Date().toISOString().slice(0, 10), saves: quellen.map((x) => x.saveId) } };
  writeFileSync(ziel, JSON.stringify(bestand, null, 2) + "\n");
  console.log(`\nBattlefield-Anker (${alt ? "orte3" : "domination5"}) geschrieben: ${ziel.pathname}`);
  process.exit(0);
}

// 22.11.: `--nur-hockey` mischt NUR den Hockey-Anker (Laeufe mit der NEUEN Torwart-Regel) in die bestehende Datei; der
// bisherige Eintrag wandert beim ersten Mal nach `hockeyAlt` (Spieltage mit der alten Regel, gezeigt = gebucht).
if (args.includes("--nur-hockey")) {
  const ziel = new URL("../data/generated/pp-skala-kalibrierung.json", import.meta.url);
  const bestand = JSON.parse(readFileSync(ziel, "utf8"));
  if (!kalibrierung.hockey) throw new Error("Keine Hockey-Zellen in den Abzuegen.");
  if (!bestand.disziplinen.hockeyAlt) bestand.disziplinen.hockeyAlt = bestand.disziplinen.hockey;
  bestand.disziplinen.hockey = kalibrierung.hockey;
  bestand.hockeyQuellen = { neu: { gemessenAm: new Date().toISOString().slice(0, 10), saves: quellen.map((x) => x.saveId) } };
  writeFileSync(ziel, JSON.stringify(bestand, null, 2) + "\n");
  console.log("\nHockey-Anker (neue Torwart-Regel) geschrieben: " + ziel.pathname);
  process.exit(0);
}

if (schreibe) {
  const ziel = new URL("../data/generated/pp-skala-kalibrierung.json", import.meta.url);
  writeFileSync(
    ziel,
    JSON.stringify(
      {
        hinweis:
          "PP-Skala C2 (docs/design/pp-skala-18-11.md): je Disziplin rTop = Median der ungedeckelten Tagesbesten (-> 5 PP), rMed = Median aller Einsaetze (-> 1,25 PP), beide auf der alten Kurvenskala; feldgroessen = dieselben Anker je Feldgroesse (ab 2 roh-Zellen), sonst gilt der Disziplin-weite Anker; faktor = 5/rTop nur zum Vergleich (Variante C). Gemessen mit scripts/miss-pp-skala.ts + scripts/werte-pp-skala-aus.mjs --schreibe-kalibrierung. Wirkt in jeder Saison mit Stempel wertungsSkalen.pp = c2.",
        ziel: PP_SKALA_ZIEL,
        gemessenAm: new Date().toISOString().slice(0, 10),
        quellen: quellen.map((x) => ({ saveId: x.saveId, spieltage: x.gespielt })),
        ...(umrechnung ? { umrechnung } : {}),
        disziplinen: Object.fromEntries(Object.entries(kalibrierung).sort((a, b) => a[0].localeCompare(b[0]))),
      },
      null,
      2,
    ) + "\n",
  );
  console.log(`\nKalibrierung geschrieben: ${ziel.pathname}`);
}
