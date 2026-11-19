// MESSUNG CLIMBING-FORMAT "CANYON" (Bau 18.11., docs/design/climbing-canyon-bau-18-11.md) -- ueber den
// Node-Motor (lib/battle/arena-node-motor.mjs, kein Chromium), mit demselben Messcode wie die
// Abnahme: `disziplinMessen()` (rangtreue-messung.mjs, Kaderfamilie aus dem Live-Save) fuer rho je
// Spiel und Saison, `window.__arena.einflussVon()` fuer die Pp-Abweichung in zwei Saatstaemmen.
//
// Aufruf:
//   node scripts/miss-climbing-canyon.mjs [n=48] [--standard] [--hilfe=aus|gedeckelt|voll]
//        [--rangeln=aus] [--pp] [--pp-n=48] [--param='{"sockel":0.4}'] [--json=datei]
//
//   --standard   misst den Standard (Schalter aus) als Gegenprobe
//   --pp         zusaetzlich Pp-Abweichung (einflussVon, Saatversatz 0 und 10 000 000)
//
// Ausgabe: rho je Spiel (Median ueber die fuenf Kader), rho Saison, Pp, Sendedauer bei 1x (Simulations-
// zeit x Zeitdehnung), Rechenzeit je Rennen, Wartezeit-Anteil und gleichzeitig Wartende (R1), mittlere
// Zeit je Weg bei gleicher Eignung (R2), Anteil der Wege, Hilfen/Rangeln/Wegwechsel je Rennen.
import path from "node:path";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { oeffneNodeSeite } from "./lib/node-arena-seite.mjs";
import { disziplinMessen, ladeKaderFamilieAusDatei, median, rhoAbnahmeLabel } from "./lib/rangtreue-messung.mjs";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const wert = (name) => args.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=");
const N = Number(args.find((a) => !a.startsWith("--")) || 48);
const STANDARD = args.includes("--standard");
const PP = args.includes("--pp");
const PP_N = Number(wert("pp-n") || 48);
const param = { ...(wert("param") ? JSON.parse(wert("param")) : {}) };
if (wert("hilfe")) param.hilfe = wert("hilfe");
if (wert("rangeln") === "aus") param.rangeln = false;

const familie = ladeKaderFamilieAusDatei(path.join(WURZEL, "data/generated/kaderfamilie-live-save.json")).familie;
const seite = await oeffneNodeSeite(path.join(WURZEL, "public/mockups"), STANDARD ? {} : { bahnFlags: { climbingFormat: "canyon" } });
const gesetzt = STANDARD ? null : await seite.evaluate((p) => window.__arena.canyonParameter(p), param);

const t0 = Date.now();
const z = await disziplinMessen(seite, "climbing", { n: N, kaderFamilie: familie });
const msRho = Date.now() - t0;

// Format-Kennzahlen aus denselben Rennen (eigener Durchlauf mit canyonDiag)
const diag = STANDARD ? null : await seite.evaluate(([n, fam]) => {
  const x = window.__arena.disziplinProbe("climbing", { n, kaderFamilie: fam, canyonDiag: true });
  return (x.varianten || [{ spiele: x.spiele }]).flatMap((v) => v.spiele.map((s) => s.canyon).filter(Boolean));
}, [Math.min(N, 24), familie]);

let pp = null;
if (PP) {
  pp = [];
  for (const versatz of [0, 10_000_000]) {
    const t = Date.now();
    const e = await seite.evaluate(([n, v]) => {
      const st = window.setTimeout; window.setTimeout = () => 0;
      try { return window.__arena.einflussVon("climbing", n, undefined, v); } finally { window.setTimeout = st; }
    }, [PP_N, versatz]);
    pp.push({ versatz, abweichungPp: e.abweichungPp, reihen: e.reihen.map((r) => ({ a: r.attribut, anteil: r.anteil })), sek: (Date.now() - t) / 1000 });
  }
}
const matrix = await seite.evaluate(() => window.__arena.matrix("climbing"));
const DEHNUNG = STANDARD ? 4.38 : await seite.evaluate(() => window.__arena.canyonZeitDehnung ? window.__arena.canyonZeitDehnung() : 1.5);
seite.schliessen();

const f = (x, k = 3) => (x == null || Number.isNaN(x) ? "—" : Number(x).toFixed(k));
console.log(`Climbing ${STANDARD ? "STANDARD (Schalter aus)" : "CANYON"} — n=${N} je Kader, ${familie.length} Kader (Node-Motor)`);
if (gesetzt) console.log(`Hilfe: ${gesetzt.hilfe} · Rangeln: ${gesetzt.rangeln ? "an" : "aus"}` + (Object.keys(param).length ? ` · Parameter ${JSON.stringify(param)}` : ""));
console.log(`rho je Spiel (Median) ${f(z.spielMed)}  Spannweite ${f(z.spielSpan)}  [${rhoAbnahmeLabel(z.spielMed)}]`);
console.log(`rho Saison   (Median) ${f(z.saisonMed)}  Spannweite ${f(z.saisonSpan)}`);
console.log(`je Kader: ${(z.varianten || []).map((v) => f(v.spiel)).join(" / ")}`);
console.log(`Rechenzeit rho-Messung ${(msRho / 1000).toFixed(1)} s fuer ${N * familie.length} Rennen = ${(msRho / (N * familie.length)).toFixed(1)} ms je Rennen`);
if (pp) for (const p of pp) {
  console.log(`Pp (Saatversatz ${p.versatz}): ${p.abweichungPp}  [${p.sek.toFixed(0)} s]  `
    + p.reihen.map((r) => `${r.a} ${r.anteil}/${matrix[r.a] ?? 0}`).join(" · "));
}
let auswertung = null;
if (diag && diag.length) {
  const rennen = diag.length;
  const zeiten = diag.map((d) => d.zeit);
  const dehnung = DEHNUNG;   // Zeitdehnung der Anzeige (Engine: CANYON_ZEIT_DEHNUNG)
  const alle = diag.flatMap((d) => d.laeufer.map((l) => ({ ...l, rennZeit: d.zeit })));
  const weltJeSim = gesetzt.tempo;   // Wartezeiten sind Welt-Sekunden
  const warteAnteil = alle.reduce((a, l) => a + l.warte, 0) / alle.reduce((a, l) => a + l.zeit * weltJeSim, 0);
  const orte = {}; for (const d of diag) for (const [k, v] of Object.entries(d.warteOrt || {})) orte[k] = (orte[k] || 0) + v / rennen;
  // R2: mittlere Zeit je Weg bei gleicher Eignung -- Residuum der Regression zeit ~ eig je Rennen
  const resid = [];
  for (const d of diag) {
    const L = d.laeufer.filter((l) => !l.hochgerechnet);
    const mx = L.reduce((a, l) => a + l.eig, 0) / L.length, my = L.reduce((a, l) => a + l.zeit, 0) / L.length;
    let sxy = 0, sxx = 0; for (const l of L) { sxy += (l.eig - mx) * (l.zeit - my); sxx += (l.eig - mx) ** 2; }
    const b = sxx ? sxy / sxx : 0;
    for (const l of L) resid.push({ weg: l.weg, wegStart: l.wegStart, r: (l.zeit - (my + b * (l.eig - mx))) / my });
  }
  const jeWeg = {};
  for (const w of ["kraft", "technik", "ausdauer"]) {
    const r = resid.filter((x) => x.wegStart === w);
    jeWeg[w] = { anteil: r.length / resid.length, abweichung: r.length ? r.reduce((a, x) => a + x.r, 0) / r.length : null };
  }
  const summe = (k) => diag.reduce((a, d) => a + (d.zaehler[k] || 0), 0) / rennen;
  auswertung = {
    // Mit dem Rest-Zeitraffer von #1617 (Anzeige: nach der ersten Glocke + 4 echte s laeuft der Rest 3x schneller)
    sendeRafferMed: median(diag.map((d) => { const f = d.erste?.ziel ?? d.zeit; const ab = Math.min(d.zeit, f + 4 / dehnung);
      return ab * dehnung + (d.zeit - ab) * dehnung / 3; })),
    sendeRafferMax: Math.max(...diag.map((d) => { const f = d.erste?.ziel ?? d.zeit; const ab = Math.min(d.zeit, f + 4 / dehnung);
      return ab * dehnung + (d.zeit - ab) * dehnung / 3; })),
    rennen, simZeitMed: median(zeiten), simZeitMax: Math.max(...zeiten), sendeMed: median(zeiten) * dehnung, sendeMax: Math.max(...zeiten) * dehnung,
    hochgerechnet: alle.filter((l) => l.hochgerechnet).length,
    warteAnteil, warteMax: Math.max(...diag.map((d) => d.warteMax)), warteDreiSekMed: median(diag.map((d) => d.warteDreiSek)), warteVierSekMed: median(diag.map((d) => d.warteVierSek)), warteVierSekMax: Math.max(...diag.map((d) => d.warteVierSek)),
    laengsteMax: Math.max(...diag.map((d) => d.laengste)), jeWeg,
    jeRennen: Object.fromEntries(["rangeln", "abgeblockt", "zieht", "schiebt", "vorstieg", "aussen", "obenrum", "wechsel", "rutsch", "sturz", "wanken", "fehlgriff", "rast"].map((k) => [k, +summe(k).toFixed(2)])),
    nebenweg: alle.filter((l) => l.eigen !== l.wegStart).length / alle.length,
  };
  console.log(`Sendedauer bei 1x: Median ${auswertung.sendeMed.toFixed(0)} s, max ${auswertung.sendeMax.toFixed(0)} s (Sim ${auswertung.simZeitMed.toFixed(1)} / ${auswertung.simZeitMax.toFixed(1)} s), hochgerechnet ${auswertung.hochgerechnet}; mit Rest-Zeitraffer (#1617) Median ${auswertung.sendeRafferMed.toFixed(0)} s, max ${auswertung.sendeRafferMax.toFixed(0)} s`);
  console.log(`Warten: Anteil ${(warteAnteil * 100).toFixed(1)} % der Kletterzeit, max gleichzeitig ${auswertung.warteMax}, >=3 zugleich Median ${auswertung.warteDreiSekMed.toFixed(2)} Sim-s je Rennen, >=4 zugleich Median ${auswertung.warteVierSekMed.toFixed(2)} / max ${auswertung.warteVierSekMax.toFixed(2)} Sim-s, laengste ${auswertung.laengsteMax.toFixed(1)} Welt-s`);
  console.log("Wege (Start): " + Object.entries(jeWeg).map(([w, x]) => `${w} ${(x.anteil * 100).toFixed(0)} % / Zeit bei gleicher Eignung ${x.abweichung == null ? "—" : ((x.abweichung > 0 ? "+" : "") + (x.abweichung * 100).toFixed(1) + " %")}`).join(" · "));
  console.log("Warteorte (Welt-s je Rennen): " + Object.entries(orte).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k} ${v.toFixed(2)}`).join(" · "));
  console.log(`Nebenweg (Seilschaft geht nicht den eigenen Profilweg): ${(auswertung.nebenweg * 100).toFixed(0)} %`);
  console.log("je Rennen: " + Object.entries(auswertung.jeRennen).map(([k, v]) => `${k} ${v}`).join(" · "));
}
if (wert("json")) {
  writeFileSync(wert("json"), JSON.stringify({ standard: STANDARD, n: N, param: gesetzt, rho: { spiel: z.spielMed, spielSpan: z.spielSpan, saison: z.saisonMed, varianten: z.varianten?.map((v) => v.spiel) }, pp, msJeRennen: msRho / (N * familie.length), auswertung }, null, 1) + "\n");
}
process.exit(0);
