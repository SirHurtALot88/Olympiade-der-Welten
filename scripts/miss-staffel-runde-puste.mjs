// STAFFEL "GANZE RUNDE, PUSTE WIRKT" (17.11.) — Kalibriersonde fuer BAHN_ART.staffel.rundePuste.
//
// Chris am 17.11.: "jeder laeuft eine ganze runde! Und dort ist puste anscheinend irrelevant weil alle
// ihre runde ohne probleme schaffen was unrealistisch ist weil sie ja alle sprinten!"
//
// Misst je Saat ein stummes Duell (Standardkader der Testseite) und meldet: tiefsten Puste-Stand je
// Laeufer (Median/Quartile), Anteil Einbrueche (Tank leer), Anteil im Fade (unter `fadeAb`), Plan-
// Verteilung und Renndauer. Optional ein Parametersatz als JSON (setzt rundePuste/kraftBasis/... fuer
// diese Sitzung ueber window.__arena.staffelRundePuste):
//
//   node scripts/miss-staffel-runde-puste.mjs [rennen] ['{"zehrFaktor":2.6,"kraftBasis":230}']
//
// Rangtreue/Pp bleiben bei scripts/miss-alle-disziplinen.mjs bzw. scripts/messe-arena-einfluss.mjs.
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import path from "node:path";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SEITE = pathToFileURL(path.join(WURZEL, "public/mockups/battle-mode.html")).href;
const RENNEN = Number(process.argv[2] || 24);
const PARAMETER = process.argv[3] ? JSON.parse(process.argv[3]) : null;
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
try {
  const seite = await browser.newPage();
  const fehler = [];
  seite.on("pageerror", (e) => fehler.push(String(e)));
  await seite.addInitScript(() => { window.AudioContext = undefined; });
  await seite.goto(SEITE, { waitUntil: "networkidle" });
  await seite.waitForFunction(() => window.__arena && window.__arena.staffelRundeLauf, null, { timeout: 60000 });
  const r = await seite.evaluate(({ RENNEN, PARAMETER }) => {
    const A = window.__arena;
    const satz = A.staffelRundePuste(PARAMETER || {});
    const alle = [], zeiten = [];
    for (let s = 1; s <= RENNEN; s += 1) {
      const e = A.staffelRundeLauf(s * 7919);
      zeiten.push(e.zeit);
      alle.push(...e.laeufer);
    }
    return { satz, alle, zeiten };
  }, { RENNEN, PARAMETER });
  const q = (a, p) => { const b = [...a].sort((x, y) => x - y); return b[Math.min(b.length - 1, Math.floor(p * b.length))]; };
  const mins = r.alle.map((l) => l.minPuste);
  const proz = (x) => (100 * x).toFixed(1).replace(".", ",") + " %";
  const plaene = {};
  for (const l of r.alle) plaene[l.plan] = (plaene[l.plan] || 0) + 1;
  console.log("Parametersatz:", JSON.stringify(r.satz));
  console.log(`Laeufer ${r.alle.length} in ${RENNEN} Rennen, Renndauer Median ${q(r.zeiten, 0.5).toFixed(2)} s`);
  console.log(`tiefste Puste: Q10 ${proz(q(mins, 0.1))} · Q25 ${proz(q(mins, 0.25))} · Median ${proz(q(mins, 0.5))} · Q75 ${proz(q(mins, 0.75))}`);
  console.log(`eingebrochen (Tank leer): ${proz(r.alle.filter((l) => l.eingebrochen).length / r.alle.length)}`);
  console.log(`im Fade (unter fadeAb): ${proz(mins.filter((m) => m < (r.satz?.fadeAb ?? 0.4)).length / mins.length)}`);
  console.log("Plaene:", JSON.stringify(plaene));
  for (const id of Object.keys(plaene)) {
    const g = r.alle.filter((l) => l.plan === id);
    console.log(`  ${id}: Einbruch ${proz(g.filter((l) => l.eingebrochen).length / g.length)}, tiefste Puste Median ${proz(q(g.map((l) => l.minPuste), 0.5))}`);
  }
  if (process.argv.includes("--vergleich")) {
    // Jeder Laeufer einmal mit Volllast ("angehen") und einmal eingeteilt ("halten"), dieselben
    // Saaten: lohnt sich die Einteilung, und fuer wen? Gruppiert nach Puste-Vorrat (Quartile).
    // Einteilung fuer den Vergleich: EIN_TEMPO/EIN_AB (Umgebung), Standard = Plan "halten".
    const EIN = { tempo: Number(process.env.EIN_TEMPO || 0.95), ab: Number(process.env.EIN_AB || 0.55) };
    const v = await seite.evaluate(({ RENNEN, PARAMETER, EIN }) => {
      const A = window.__arena;
      const basis = A.staffelRundePuste({});
      const orig = { angehen: null, halten: null };
      const lauf = (planWerte) => {
        A.staffelRundePuste({ ...(PARAMETER || {}), planNachPuste: false,
          plaene: { halten: planWerte, angehen: planWerte, schluss: planWerte } });
        const aus = [];
        for (let s = 1; s <= RENNEN; s += 1) aus.push(...A.staffelRundeLauf(s * 7919).laeufer.map((l) => ({ ...l, s })));
        return aus;
      };
      const voll = lauf({ tempo: 1.0, ab: 0.0 });
      const ein = lauf(EIN);
      return { voll, ein, basis, orig };
    }, { RENNEN, PARAMETER, EIN });
    const schl = (l) => l.s + "|" + l.seite + "|" + l.n;
    const ein = new Map(v.ein.map((l) => [schl(l), l]));
    const paare = v.voll.map((l) => ({ voll: l, ein: ein.get(schl(l)) })).filter((p) => p.ein && p.voll.etappe && p.ein.etappe);
    // Gruppiert nach der Selbsteinschaetzung `quote` (erwarteter Volllast-Verbrauch / Vorrat),
    // in Quintilen: zeigt, ab welcher Quote sich die Einteilung lohnt (-> planSchwelle).
    const R = paare.map((p) => p.voll.quote ?? 0).sort((a, b) => a - b);
    const grenzen = [0.2, 0.4, 0.6, 0.8].map((x) => R[Math.floor(x * R.length)]);
    for (let g = 0; g < 5; g += 1) {
      const lo = g === 0 ? -Infinity : grenzen[g - 1], hi = g === 4 ? Infinity : grenzen[g];
      const t = paare.filter((p) => (p.voll.quote ?? 0) >= lo && (p.voll.quote ?? 0) < hi);
      const d = t.reduce((s, p) => s + (p.ein.etappe - p.voll.etappe), 0) / Math.max(1, t.length);
      const besser = t.filter((p) => p.ein.etappe < p.voll.etappe).length / Math.max(1, t.length);
      console.log(`Quote-Quintil ${g + 1} (${lo === -Infinity ? "" : lo.toFixed(3)}..${hi === Infinity ? "" : hi.toFixed(3)}): n=${t.length}, Etappe eingeteilt - Volllast = ${d.toFixed(3)} s, Einteilung besser in ${(100 * besser).toFixed(0)} %, ` +
        `Einbruch voll ${(100 * t.filter((p) => p.voll.eingebrochen).length / Math.max(1, t.length)).toFixed(0)} % / eingeteilt ${(100 * t.filter((p) => p.ein.eingebrochen).length / Math.max(1, t.length)).toFixed(0)} %`);
    }
  }
  console.log("Seitenfehler:", fehler.length ? fehler.join(" | ") : "keine");
} finally {
  await browser.close();
}
