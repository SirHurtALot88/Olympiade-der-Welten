// KULISSEN-ABNAHME (Oberflaechen-Effekte, 08.11., docs/design/oberflaechen-effekte-konzept-08-11.md
// Abschnitt 3.3 und 7). Die Pflichtzahlen aus CLAUDE.md je Kulissen-Variante einzeln, dazu die zwei
// Zusatzproben des Konzepts (Star, Mittelfeld) -- alles kaderfest ueber die live-save-Kaderfamilie.
//
//   node scripts/miss-kulisse-abnahme.mjs <disziplin> [spiele=24] [--pp=<laeufe>] [--ohne-pp]
//
// Je Variante (plus "aus" = Referenz ohne Effekt und "mittel" = ungepinnt, jedes Spiel waehlt seine
// Variante selbst aus der Saat):
//   rho je Spiel gegen die MATRIX-Eignung (Median ueber die Kaderfamilie)       Schranke > 0,80
//   rho je Spiel gegen die Varianten-Eignung eig+OW (Transparenz-Probe)        >= rho gegen Matrix
//   Star auf Rang 1 / in den ersten zwei (eignungsbester Teilnehmer je Spiel)  >= "aus" - 3 Pp
//   Paare ab 15 Eignungspunkten Abstand richtig geordnet                        >= 98 %
//   Mittelfeld-Probe: mittlere |Rangbewegung| gegenueber "aus" je Eignungsdrittel
//                     (gepaart: dieselben Saaten, Formkarten, Mutatoren)      oben < 0,5; Mitte >= oben
//   groesster |OW| ueber alle Teilnehmer                                        <= Deckel
//   Pp gegen W_variante (Matrix + Profil), zwei Saatstroeme (Versatz 0 / 10 000 000)   <= 25
// und fuer "mittel"/"aus" die Pp gegen die Matrix auf beiden Stroemen.
import { chromium } from "playwright";
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { rho, median, spannweite, ladeKaderFamilieAusDatei } from "./lib/rangtreue-messung.mjs";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SEITE = pathToFileURL(path.join(WURZEL, "public/mockups/battle-mode.html")).href;
const FEST = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const args = process.argv.slice(2);
const pos = args.filter((a) => !a.startsWith("--"));
const wert = (n) => args.find((a) => a.startsWith(`--${n}=`))?.split("=")[1];
const DISZIPLIN = pos[0] || "tennis";
const SPIELE = Number(pos[1] || 24);
const PP_LAEUFE = Number(wert("pp") || 24);
const OHNE_PP = args.includes("--ohne-pp");
// --saat0=<n>: zweiter, unabhaengiger Saatstrom fuer die rho-Proben (disziplinProbe saat0, Standard 1337).
const SAAT0 = wert("saat0") != null ? Number(wert("saat0")) : null;
const STROEME = [0, 10_000_000];

const geladen = ladeKaderFamilieAusDatei(process.env.OLY_KADER_FAMILIE
  || path.join(WURZEL, "data/generated/kaderfamilie-live-save.json"));
if (!geladen) { console.error("Kaderfamilie fehlt (data/generated/kaderfamilie-live-save.json)."); process.exit(1); }
const familie = geladen.familie;

// Rang 1 = hoechster Wert; Gleichstaende bekommen den mittleren Rang.
function raenge(liste, key) {
  const s = liste.map((t, i) => ({ i, v: t[key] })).sort((a, b) => b.v - a.v);
  const r = new Array(liste.length); let k = 0;
  while (k < s.length) { let j = k; while (j + 1 < s.length && s[j + 1].v === s[k].v) j++;
    for (let m = k; m <= j; m++) r[s[m].i] = (k + j) / 2 + 1; k = j + 1; }
  return r;
}

function kennzahlen(varianten, referenz) {
  const rhoM = [], rhoK = [];
  let star1 = 0, star2 = 0, spiele = 0, paare = 0, paareOk = 0, owMax = 0;
  const bewegung = [[], [], []];
  varianten.forEach((v, vi) => {
    const jeSpielM = [], jeSpielK = [];
    v.spiele.forEach((sp, si) => {
      const t = sp.teilnehmer;
      jeSpielM.push(rho(t));
      if (t.every((x) => x.eigKulisse != null)) jeSpielK.push(rho(t.map((x) => ({ eig: x.eigKulisse, wert: x.wert }))));
      for (const x of t) if (x.kulisseOW != null) owMax = Math.max(owMax, Math.abs(x.kulisseOW));
      const rW = raenge(t, "wert");
      const star = t.reduce((b, x, i) => (x.eig > t[b].eig ? i : b), 0);
      spiele++; if (rW[star] <= 1) star1++; if (rW[star] <= 2) star2++;
      for (let a = 0; a < t.length; a++) for (let b = a + 1; b < t.length; b++) {
        if (Math.abs(t[a].eig - t[b].eig) < 15) continue;
        paare++;
        const hoch = t[a].eig > t[b].eig ? t[a] : t[b], tief = hoch === t[a] ? t[b] : t[a];
        if (hoch.wert > tief.wert) paareOk++;
      }
      if (referenz) {
        const ref = referenz[vi].spiele[si].teilnehmer;
        const rRef = raenge(ref, "wert");
        const nachName = new Map(ref.map((x, i) => [x.n + "|" + x.seite, rRef[i]]));
        const rEig = raenge(t, "eig");
        t.forEach((x, i) => {
          const drittel = Math.min(2, Math.floor((rEig[i] - 1) / (t.length / 3)));
          const alt = nachName.get(x.n + "|" + x.seite);
          if (alt != null) bewegung[drittel].push(Math.abs(rW[i] - alt));
        });
      }
    });
    const m = (a) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
    rhoM.push(m(jeSpielM.filter((x) => !Number.isNaN(x))));
    if (jeSpielK.length) rhoK.push(m(jeSpielK.filter((x) => !Number.isNaN(x))));
  });
  const m = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
  return {
    rhoMatrix: median(rhoM), rhoMatrixSpan: spannweite(rhoM),
    rhoKulisse: rhoK.length ? median(rhoK) : null,
    star1: star1 / spiele, star2: star2 / spiele,
    paare15: paare ? paareOk / paare : null, paare15n: paare,
    bewegung: bewegung.map(m), owMax,
  };
}

const browser = await chromium.launch(existsSync(FEST) ? { executablePath: FEST } : {});
const ausgabe = { disziplin: DISZIPLIN, spiele: SPIELE, kaderQuelle: geladen.quelle, varianten: {}, pp: {} };
try {
  const seite = await browser.newPage();
  await seite.addInitScript(() => { window.AudioContext = undefined; window.webkitAudioContext = undefined; });
  await seite.goto(SEITE, { waitUntil: "networkidle" });
  await seite.waitForFunction(() => window.__arena && window.__arena.kulisseProfile, null, { timeout: 60000 });
  const profil = (await seite.evaluate(() => window.__arena.kulisseProfile()))[DISZIPLIN];
  if (!profil) { console.error(`Kein Kulissen-Profil fuer ${DISZIPLIN}.`); process.exit(1); }
  const probe = (kulisse) => seite.evaluate(([d, n, fam, k, s0]) => window.__arena.disziplinProbe(d,
    { n, kaderFamilie: fam, ...(k ? { kulisse: k } : {}), ...(s0 != null ? { saat0: s0, mutatorSaat: s0 } : {}) }),
    [DISZIPLIN, SPIELE, familie, kulisse, SAAT0]);

  const aus = (await probe("aus")).varianten;
  ausgabe.varianten.aus = kennzahlen(aus, null);
  for (const v of [...profil.varianten, null]) {
    const erg = (await probe(v)).varianten;
    ausgabe.varianten[v || "mittel"] = kennzahlen(erg, aus);
  }

  if (!OHNE_PP) {
    const pp = (kulisse, ziel, versatz) => seite.evaluate(([d, n, ver, opt]) => {
      const st = window.setTimeout; window.setTimeout = () => 0;
      try { return window.__arena.einflussVon(d, n, undefined, ver, undefined, undefined, opt); }
      finally { window.setTimeout = st; }
    }, [DISZIPLIN, PP_LAEUFE, versatz, kulisse ? { kulisse, ...(ziel ? { ziel } : {}) } : undefined]);
    for (const versatz of STROEME) {
      const zeile = {};
      zeile["aus/matrix"] = (await pp("aus", null, versatz)).abweichungPp;
      zeile["mittel/matrix"] = (await pp(null, null, versatz)).abweichungPp;
      for (const v of profil.varianten) {
        const e = await pp(v, "variante", versatz);
        zeile[`${v}/variante`] = e.abweichungPp;
        zeile[`${v}/reihen`] = e.reihen.map((r) => `${r.attribut} ${r.anteil}/${e.zielGewichte[r.attribut] || 0}`).join(", ");
        zeile[`${v}/matrix`] = (await pp(v, null, versatz)).abweichungPp;
      }
      ausgabe.pp[`versatz ${versatz}`] = zeile;
    }
  }
} finally {
  await browser.close();
}

const f = (x, d = 3) => (x == null ? "—" : x.toFixed(d));
const pz = (x) => (x == null ? "—" : (100 * x).toFixed(1) + " %");
console.log(`Kulissen-Abnahme ${DISZIPLIN} — ${SPIELE} Spiele je Kader-Variante, ${familie.length} Varianten (${geladen.quelle})`
  + (SAAT0 != null ? `, Saatstrom saat0=${SAAT0}` : "") + "\n");
console.log("Variante   rho Matrix (Span)   rho eig+OW   Star R1   Star R1-2   Paare>=15   Bewegung oben/mitte/unten   max|OW|");
for (const [name, k] of Object.entries(ausgabe.varianten)) {
  console.log(name.padEnd(10) + `${f(k.rhoMatrix)} (${f(k.rhoMatrixSpan)})`.padStart(18)
    + f(k.rhoKulisse).padStart(13) + pz(k.star1).padStart(10) + pz(k.star2).padStart(12)
    + pz(k.paare15).padStart(12)
    + (k.bewegung.some((b) => b != null) ? k.bewegung.map((b) => f(b, 2)).join(" / ") : "—").padStart(28)
    + f(k.owMax, 2).padStart(10));
}
if (!OHNE_PP) {
  console.log(`\nPp-Abweichung (einflussVon, ${PP_LAEUFE} Laeufe, Anhebung +15):`);
  for (const [strom, zeile] of Object.entries(ausgabe.pp)) {
    console.log(`  ${strom}`);
    for (const [k, w] of Object.entries(zeile)) if (!k.endsWith("/reihen")) console.log(`    ${k.padEnd(20)} ${w}`);
    for (const [k, w] of Object.entries(zeile)) if (k.endsWith("/reihen")) console.log(`    ${k.padEnd(20)} ${w}`);
  }
}
if (process.env.OLY_JSON) console.log("\nJSON " + JSON.stringify(ausgabe));
