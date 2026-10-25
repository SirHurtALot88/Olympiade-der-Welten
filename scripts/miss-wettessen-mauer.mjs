// ===================================================================================
// WETTESSEN „DIE MAUER, DIE HALTUNG" — die Kennzahlen von K1/K2 am ECHTEN Motor.
//
// docs/design/wettessen-nachtkonzept-03-10.md, Abschnitt 5: die Konzept-Sonde war ein
// Scratch-Modell ohne Slot-/Form-/Mutator-Zuschlag (Ist-rho 0,95 statt 0,87) — sie konnte nur
// die Richtung zeigen. Dieses Skript misst am Motor selbst (disziplinProbe mit buehneDiag),
// kaderfest ueber die Kader-Familie, mit den Mechaniken hinter BUEHNE_FLAGS.wettessenMauer:
//
//   - rho je Spiel (Median), Kurve je Minute, Mauer-Minute (Median/Spanne/"nie")
//   - Haltung laut KI-Vorgabe (bzw. Messvorgabe) und Verteilung
//   - DER TOTE-KNOPF-TEST (Konzept 5.2 Punkt 5): fuer jeden Esser in jedem Spiel die erwartete
//     Summe unter allen drei Haltungen (feste private Zufallsstroeme, gemeinsame Zufallszahlen) —
//     welche Haltung waere die beste? Kriterium: jede Haltung fuer mindestens ein Fuenftel der
//     Esser die beste, und die beste Haltung haengt an NERVEN, nicht an der Eignung.
//
//   node scripts/miss-wettessen-mauer.mjs [spiele] --flags=wettessenMauer:2 [--ev=40] [--je-seite=N] [--haltung-heim=sprint]
// ===================================================================================
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import path from "node:path";
import {
  ladeKaderFamilieAusDatei, auswerten, median, rho, IST_BUEHNE_SCHALTER, buehneSchalterAusArgs,
  setzeBuehneSchalter, buehneSchalterText,
} from "./lib/rangtreue-messung.mjs";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SEITE = pathToFileURL(path.join(WURZEL, "public/mockups/battle-mode.html")).href;
const KADERFAMILIE_PFAD = process.env.OLY_KADER_FAMILIE
  || path.join(WURZEL, "data/generated/kaderfamilie-live-save.json");
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const args = process.argv.slice(2);
const SCHALTER = buehneSchalterAusArgs(args);
const wert = (n) => args.find((a) => a.startsWith(`--${n}=`))?.split("=")[1];
const JE_SEITE = wert("je-seite") ? Number(wert("je-seite")) : null;
const EV = Number(wert("ev") ?? 40);
const rest = args.filter((a) => !IST_BUEHNE_SCHALTER(a) && !a.startsWith("--je-seite=") && !a.startsWith("--ev="));
const SPIELE = Number(rest[0] || 24);

const geladen = ladeKaderFamilieAusDatei(KADERFAMILIE_PFAD);
if (!geladen) { console.error("Kader-Familie fehlt: " + KADERFAMILIE_PFAD); process.exit(1); }

const browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
let x, gesetzt, fehler = [];
try {
  const seite = await browser.newPage();
  await seite.addInitScript(() => { window.AudioContext = undefined; window.webkitAudioContext = undefined; });
  seite.on("pageerror", (e) => fehler.push(String(e)));
  await seite.goto(SEITE, { waitUntil: "networkidle" });
  await seite.waitForFunction(() => window.__arena && window.__arena.disziplinProbe, null, { timeout: 30000 });
  gesetzt = await setzeBuehneSchalter(seite, SCHALTER);
  x = await seite.evaluate(([n, familie, js, ev]) => window.__arena.disziplinProbe("wettessen",
    { n, kaderFamilie: familie, buehneDiag: true, haltungEV: ev, ...(js ? { jeSeite: js } : {}) }),
  [SPIELE, geladen.familie, JE_SEITE, EV]);
} finally {
  await browser.close();
}
if (x.fehler) { console.error(x.fehler); process.exit(1); }

const H = ["sprint", "gleichmaessig", "schlussspurt"];
const rhoJe = [], mauer = [], kurve = Array(10).fill(0); let kurveN = 0, nieMauer = 0;
const gewaehlt = {}, beste = {}, besteJeNerven = {}, bestePaare = [];
const pauschalVerlust = {};
let esserN = 0, kiTrifft = 0, verlustSumme = 0, spieleN = 0, heim = 0, gast = 0, unent = 0;
for (const v of x.varianten) {
  rhoJe.push(auswerten(v.spiele).spiel);
  for (const sp of v.spiele) {
    if (sp.buehne && sp.buehne.seiten) {
      spieleN++;
      const [h, g] = sp.buehne.seiten;
      if (h > g) heim++; else if (g > h) gast++; else unent++;
    }
    const es = sp.buehne && sp.buehne.esser; if (!es) continue;
    for (const e of es) {
      esserN++;
      if (e.mauerMinute == null) nieMauer++; else mauer.push(e.mauerMinute);
      e.kurve.forEach((p, i) => { kurve[i] += p; }); kurveN++;
      gewaehlt[e.haltung] = (gewaehlt[e.haltung] || 0) + 1;
      if (e.ev) {
        const b = H.reduce((a, h) => (e.ev[h] > e.ev[a] ? h : a), "gleichmaessig");
        beste[b] = (beste[b] || 0) + 1;
        const bin = e.NERVEN < 45 ? "<45" : e.NERVEN < 60 ? "45-59" : ">=60";
        besteJeNerven[bin] = besteJeNerven[bin] || { n: 0 };
        besteJeNerven[bin].n++; besteJeNerven[bin][b] = (besteJeNerven[bin][b] || 0) + 1;
        if (b === e.haltung) kiTrifft++;
        verlustSumme += e.ev[b] - e.ev[e.haltung];
        for (const h of H) pauschalVerlust[h] = (pauschalVerlust[h] || 0) + e.ev[b] - e.ev[h];
        bestePaare.push({ nerven: e.NERVEN, eig: e.eig, b });
      }
    }
  }
}
const pz = (a, b) => (100 * a / Math.max(1, b)).toFixed(1).padStart(5) + " %";
mauer.sort((a, b) => a - b);
console.log(`Wettessen-Mauer — ${SPIELE} Spiele je Kader-Variante, ${x.varianten.length} Varianten`
  + (JE_SEITE ? `, ${JE_SEITE} je Seite` : "") + `, Erwartung ueber ${EV} Stroeme`);
console.log(`Kader-Quelle: ${geladen.quelle}`);
console.log(gesetzt ? buehneSchalterText(gesetzt) : "Buehnen-Flags: alle aus (heutiger Motor)");
console.log("");
console.log(`rho je Spiel (Median ueber Familie)  ${median(rhoJe).toFixed(3)}   [${rhoJe.map((r) => r.toFixed(3)).join(" ")}]`);
console.log(`Kurve je Minute (Mittel)            ${kurve.map((s) => (s / Math.max(1, kurveN)).toFixed(1)).join(" ")}`);
if (mauer.length || nieMauer) {
  console.log(`Mauer-Minute Median / Spanne        ${mauer.length ? median(mauer) : "—"} / ${mauer[0] ?? "—"}-${mauer[mauer.length - 1] ?? "—"}, nie an der Mauer ${pz(nieMauer, esserN)}`);
}
console.log(`Heim / Gast / unentschieden          ${pz(heim, spieleN)} / ${pz(gast, spieleN)} / ${pz(unent, spieleN)}`);
console.log(`Haltung gewaehlt                    ` + H.map((h) => `${h} ${pz(gewaehlt[h] || 0, esserN)}`).join(" · "));
if (Object.keys(beste).length) {
  console.log(`BESTE Haltung (Erwartung)           ` + H.map((h) => `${h} ${pz(beste[h] || 0, esserN)}`).join(" · "));
  for (const bin of ["<45", "45-59", ">=60"]) {
    const b = besteJeNerven[bin]; if (!b) continue;
    console.log(`  NERVEN ${bin.padEnd(6)} (n=${String(b.n).padStart(4)})       ` + H.map((h) => `${h} ${pz(b[h] || 0, b.n)}`).join(" · "));
  }
  console.log(`KI-Vorgabe trifft die beste Haltung ${pz(kiTrifft, esserN)}, mittlerer Verlust ${(verlustSumme / esserN).toFixed(1)} Punkte je Esser`);
  // KEIN KNOPF IMMER BESSER: was kostet es, ALLE Esser pauschal auf eine Haltung zu stellen,
  // gemessen gegen die beste Haltung je Esser (dieselbe Erwartung, dieselben Stroeme)?
  console.log(`Verlust pauschal (Punkte je Esser) ` + H.map((h) => `alle ${h} ${(pauschalVerlust[h] / esserN).toFixed(1)}`).join(" · ") + ` · KI ${(verlustSumme / esserN).toFixed(1)}`);
  // Haengt die beste Haltung an NERVEN oder an der Eignung? Rangkorrelation zwischen dem
  // Haltungs-Index in der Reihenfolge der KI-Regel (gleichmaessig 0 = NERVEN < 45, sprint 1 =
  // 45-59, schlussspurt 2 = ab 60) und NERVEN bzw. eig.
  const idx = (h) => ({ gleichmaessig: 0, sprint: 1, schlussspurt: 2 })[h];
  const rN = rho(bestePaare.map((p) => ({ eig: p.nerven, wert: idx(p.b) })));
  const rE = rho(bestePaare.map((p) => ({ eig: p.eig, wert: idx(p.b) })));
  console.log(`rho(beste Haltung, NERVEN) ${rN.toFixed(3)} · rho(beste Haltung, Eignung) ${rE.toFixed(3)}`);
}
console.log("Seitenfehler: " + (fehler.length ? fehler.slice(0, 3).join(" | ") : "keine"));
