// ===================================================================================
// TDM-GEFECHT-ABNAHME — PROTOTYP (10.11.), Vorbild scripts/miss-battlefield-pod-ffa-abnahme.mjs.
//
// Misst `window.__arena.tdmGefecht()` (battle-mode.engine.js, Kopfkommentar bei
// TDM_GEFECHT_GRUND): das vorab entschiedene TDM-Gefecht, NICHT das produktive TDM (das laeuft
// weiter ueber die PPS-Duell-Bruecke, s. lib/battle/arena-resolved-disciplines.ts). Reiner
// Mess-/Kalibrierschritt — nichts hier ist an Buchung oder Arena-Anzeige angeschlossen.
//
// ANDERS ALS BATTLEFIELD: TDM ist zweiseitig (ein echtes Arena-Duell), keine Vierergruppe. Die
// "Gruppen" unten sind deshalb PAARE aus der Kader-Familie, nicht Vierergruppen.
//
//  - rho je Spiel zwischen `eig` (ohne Mutator) und `wert` (Anteil am Gesamtbeitrag) ueber ALLE
//    2k Kaempfer eines Gefechts — dieselbe Groesse wie disziplinProbe im alten Duell. Kaderfest:
//    die zehn ECHTEN Team-Kader der Kader-Familie, Paare daraus. Abnahmezahl = Median ueber die
//    Paare des Paar-Mittels, dazu Mittel, Spannweite, Paare unter 0,80, Saison-Validitaet.
//  - die ehrlicheren Abnahmen aus CLAUDE.md: Star auf Rang 1 / unter den ersten zwei, Paartreue
//    nach Eignungsabstand.
//  - `--kontrolle`: dieselbe Kadergroesse im ALTEN Duell (disziplinProbe("tdm", ...)), damit der
//    Abstand Duell -> Gefecht mit denselben Kadern gemessen ist.
//  - PP (`--pp[=laeufe]`, Budget-Methode, Pflicht nach CLAUDE.md): `window.__arena.
//    tdmGefechtEinfluss` — exakt einflussVon()/battlefieldPodEinfluss(), nur als Gefecht statt
//    Zweikampf. Ziel <= 25 Pp in beiden Saatstroemen.
//
//   node scripts/miss-tdm-gefecht-abnahme.mjs [Gefechte je Paar] [--je-seite=2..6]
//        [--paare=<Anzahl, Standard 30 von 45>] [--kontrolle] [--stroeme=0,10000000]
//        [--pp[=24]] [--pp-je-seite=k|2..6] [--nur-pp] [--json=<Datei>]
// ===================================================================================
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { rho, median } from "./lib/rangtreue-messung.mjs";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const wert = (name) => { const a = args.find((x) => x.startsWith(`--${name}=`)); return a ? a.slice(name.length + 3) : null; };
const hat = (name) => args.includes(`--${name}`);
const positionen = args.filter((a) => !a.startsWith("--"));
const SPIELE = Number(positionen[0] || 4);
const SEITE = pathToFileURL(wert("seite") || path.join(WURZEL, "public/mockups/battle-mode.html")).href;
const JSON_AUS = wert("json");
const STROEME = (wert("stroeme") || "0,10000000").split(",").map(Number);
function parseListe(roh) {
  if (!roh) return [6];
  const b = roh.match(/^(\d+)\.\.(\d+)$/);
  if (b) return Array.from({ length: Number(b[2]) - Number(b[1]) + 1 }, (_, i) => Number(b[1]) + i);
  return roh.split(",").map(Number);
}
const JE_SEITE = parseListe(wert("je-seite"));
const PAARE_ANZAHL = Number(wert("paare") || 30);
const KONTROLLE = hat("kontrolle");
const MIT_PP = hat("pp") || args.some((x) => x.startsWith("--pp=")) || hat("nur-pp");
const PP_LAEUFE = Number(wert("pp") || 24);
const NUR_PP = hat("nur-pp");
const PP_JE_SEITE_LISTE = wert("pp-je-seite") ? parseListe(wert("pp-je-seite")) : [undefined];

// --- Kader: zehn Teams aus der Familie (dieselbe Extraktion wie miss-battlefield-pod-ffa-abnahme.mjs) ---
const familie = JSON.parse(readFileSync(path.join(WURZEL, "data/generated/kaderfamilie-live-save.json"), "utf8"));
const teamsNachName = new Map();
for (const v of familie.varianten) {
  if (!teamsNachName.has(v.heimName)) teamsNachName.set(v.heimName, v.heim);
  if (!teamsNachName.has(v.gastName)) teamsNachName.set(v.gastName, v.gast);
}
const TEAMNAMEN = [...teamsNachName.keys()];
const KADER = TEAMNAMEN.map((n) => teamsNachName.get(n));
const T = KADER.length;
const ALLE2 = [];
for (let a = 0; a < T; a++) for (let b = a + 1; b < T; b++) ALLE2.push([a, b]);
const schritt = Math.max(1, Math.floor(ALLE2.length / Math.max(1, PAARE_ANZAHL)));
const PAARE = ALLE2.filter((_, i) => i % schritt === 0).slice(0, PAARE_ANZAHL);

// --- Auswertung -------------------------------------------------------------------------
const mittel = (a) => { const b = a.filter((v) => Number.isFinite(v)); return b.reduce((x, y) => x + y, 0) / Math.max(1, b.length); };
function auswerten(events) {
  const jePaar = new Map();
  const saison = new Map();
  let star1 = 0, star2 = 0, starLetzt = 0, teamBesterGewinnt = 0, teamBesterOben2 = 0, teamBesterLetzter = 0;
  const paar = { gross: [0, 0], mittel: [0, 0], klein: [0, 0] };
  const enden = { allein: 0, zeit: 0 };
  const dauer = [];
  for (const ev of events) {
    const t = ev.teilnehmer;
    (jePaar.get(ev.paar) || jePaar.set(ev.paar, []).get(ev.paar)).push(rho(t.map((x) => ({ eig: x.eig, wert: x.wert }))));
    const sortiert = [...t].sort((a, b) => b.wert - a.wert);
    const rangVon = (x) => sortiert.findIndex((y) => y.wert === x.wert) + 1;
    const star = [...t].sort((a, b) => b.eig - a.eig)[0];
    const sr = rangVon(star);
    if (sr === 1) star1++;
    if (sr <= 2) star2++;
    if (sr === t.length) starLetzt++;
    for (let i = 0; i < t.length; i++) for (let j = i + 1; j < t.length; j++) {
      const [a, b] = [t[i], t[j]];
      const ab = Math.abs(a.eig - b.eig);
      const korb = ab >= 15 ? paar.gross : ab >= 5 ? paar.mittel : paar.klein;
      const besser = a.eig >= b.eig ? a : b, schlechter = besser === a ? b : a;
      korb[0] += besser.wert > schlechter.wert ? 1 : besser.wert === schlechter.wert ? 0.5 : 0;
      korb[1]++;
    }
    for (const x of t) {
      const sk = ev.teamsIx[x.side] + ":" + x.n;
      const s = saison.get(sk) || { eig: 0, wert: 0, k: 0 }; s.eig += x.eig; s.wert += x.wert; s.k++; saison.set(sk, s);
    }
    const N = ev.teams.length;
    const teamEig = Array.from({ length: N }, (_, s) => mittel(t.filter((x) => x.side === s).map((x) => x.eig)));
    const bester = teamEig.indexOf(Math.max(...teamEig));
    if (ev.teams[bester].eventPlatz === 1) teamBesterGewinnt++;
    if (ev.teams[bester].eventPlatz <= 2) teamBesterOben2++;
    if (ev.teams[bester].eventPlatz === N) teamBesterLetzter++;
    if (ev.ende) enden[ev.ende] = (enden[ev.ende] || 0) + 1;
    dauer.push(ev.dauer);
  }
  const paarMittel = [...jePaar.values()].map((l) => mittel(l));
  const E = events.length;
  const q = (k) => (k[1] ? (100 * k[0]) / k[1] : NaN);
  return {
    events: E, paare: paarMittel.length,
    rhoMedian: median(paarMittel), rhoMittel: mittel(paarMittel),
    rhoMin: Math.min(...paarMittel), rhoMax: Math.max(...paarMittel),
    paareUnter80: paarMittel.filter((v) => v < 0.8).length,
    rhoSaison: rho([...saison.values()].map((s) => ({ eig: s.eig / s.k, wert: s.wert / s.k }))),
    star1: (100 * star1) / E, star2: (100 * star2) / E, starLetzt: (100 * starLetzt) / E,
    paarGross: q(paar.gross), paarMittel: q(paar.mittel), paarKlein: q(paar.klein),
    teamBesterGewinnt: (100 * teamBesterGewinnt) / E, teamBesterOben2: (100 * teamBesterOben2) / E,
    teamBesterLetzter: (100 * teamBesterLetzter) / E,
    endeAllein: (100 * (enden.allein || 0)) / E, endeZeit: (100 * (enden.zeit || 0)) / E,
    dauerMittel: mittel(dauer),
  };
}

const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
const ausgabe = { disziplin: "tdm", format: "gefecht", spiele: SPIELE, stroeme: STROEME, teams: TEAMNAMEN, paare: PAARE, laeufe: [], kontrolle: [] };
const fehler = [];
try {
  const seite = await browser.newPage();
  await seite.addInitScript(() => { window.AudioContext = undefined; window.webkitAudioContext = undefined; });
  seite.on("pageerror", (e) => fehler.push(String(e)));
  await seite.goto(SEITE, { waitUntil: "networkidle" });
  await seite.waitForFunction(() => window.__arena && window.__arena.tdmGefechtSonde, null, { timeout: 60000 });
  if (!NUR_PP) for (const js of JE_SEITE) {
    for (const versatz of STROEME) {
      const t0 = Date.now();
      const roh = await seite.evaluate(([kader, paare, n, versatz, js]) => {
        const st = window.setTimeout; window.setTimeout = () => 0;
        try { return window.__arena.tdmGefechtSonde(kader, { gruppen: paare, n, versatz, jeSeite: js }); }
        finally { window.setTimeout = st; }
      }, [KADER, PAARE, SPIELE, versatz, js]);
      const sek = (Date.now() - t0) / 1000;
      // `ev.gruppe` -> `ev.paar` fuer die Auswertung oben (dieselben Events, nur umbenannt gelesen).
      const events = roh.events.map((ev) => ({ ...ev, paar: ev.gruppe }));
      ausgabe.laeufe.push({ format: "gefecht (N=2)", jeSeite: js, versatz, sekunden: sek, msJeKampf: (1000 * sek) / events.length, ...auswerten(events) });
      if (KONTROLLE) {
        const k = await seite.evaluate(([fam, n, versatz, js]) => {
          const st = window.setTimeout; window.setTimeout = () => 0;
          try {
            const A = window.__arena, aus = [];
            for (const v of fam) {
              A.kaderSetzen({ heim: v.heim, gast: v.gast });
              const p = A.disziplinProbe("tdm", { n, saat0: 1337 + versatz, jeSeite: js });
              aus.push(p.spiele);
            }
            return aus;
          } finally { window.setTimeout = st; }
        }, [familie.varianten, Math.max(SPIELE * 2, 12), versatz, js]);
        const jeVariante = k.map((spiele) => mittel(spiele.map((s) => rho(s.teilnehmer))));
        ausgabe.kontrolle.push({ format: "duell (N=2, Familienpaarungen, disziplinProbe)", jeSeite: js, versatz, rhoMedian: median(jeVariante), rhoMittel: mittel(jeVariante), jeVariante });
      }
    }
  }
  if (MIT_PP) {
    ausgabe.pp = [];
    for (const ppJs of PP_JE_SEITE_LISTE) for (const versatz of STROEME) {
      const t0 = Date.now();
      const r = await seite.evaluate(([n, v, js]) => {
        const st = window.setTimeout; window.setTimeout = () => 0;
        try { return window.__arena.tdmGefechtEinfluss(n, undefined, v, undefined, js); }
        finally { window.setTimeout = st; }
      }, [PP_LAEUFE, versatz, ppJs]);
      ausgabe.pp.push({ ...r, sekunden: (Date.now() - t0) / 1000 });
    }
  }
} finally {
  await browser.close();
}

const f3 = (v) => (Number.isFinite(v) ? v.toFixed(3) : "  —  ");
const f1 = (v) => (Number.isFinite(v) ? v.toFixed(1) : " — ");
console.log(`TDM-Gefecht-Abnahme (Prototyp) — ${SPIELE} Gefechte je Paar, ${ausgabe.paare.length} von ${ALLE2.length} Paaren, Saatstroeme ${STROEME.join(" / ")}`);
console.log(`Kader: ${TEAMNAMEN.length} Teams der Kader-Familie\n`);
console.log("k  Strom     rho/Spiel Median  Mittel  min..max       <0,80  Saison  Star#1  Star<=2  letzt  Paar>=15  bestesTeam 1./<=2./letzt  Ende allein/zeit  Dauer  ms/Gefecht");
for (const l of ausgabe.laeufe) {
  console.log(
    `${String(l.jeSeite).padEnd(2)} ${String(l.versatz).padEnd(9)} ${f3(l.rhoMedian).padStart(16)}  ${f3(l.rhoMittel)}  ${f3(l.rhoMin)}..${f3(l.rhoMax)}  ${String(l.paareUnter80).padStart(3)}/${l.paare}  ${f3(l.rhoSaison)}  ${f1(l.star1).padStart(6)}  ${f1(l.star2).padStart(7)}  ${f1(l.starLetzt).padStart(5)}  ${f1(l.paarGross).padStart(8)}  ${f1(l.teamBesterGewinnt).padStart(6)}/${f1(l.teamBesterOben2)}/${f1(l.teamBesterLetzter)}  ${f1(l.endeAllein).padStart(10)}/${f1(l.endeZeit)}  ${f1(l.dauerMittel).padStart(5)}  ${l.msJeKampf.toFixed(0).padStart(7)}`,
  );
}
for (const k of ausgabe.kontrolle) console.log(`Kontrolle Duell k=${k.jeSeite} Strom ${k.versatz}: rho/Spiel Median ${f3(k.rhoMedian)}, Mittel ${f3(k.rhoMittel)}  [${k.jeVariante.map(f3).join(" ")}]`);
console.log("Schranke (CLAUDE.md): rho je Spiel ueber 0,80, angestrebt 0,85.");
for (const p of ausgabe.pp || []) {
  console.log(`Pp-Abweichung (Gefecht, k=${p.jeSeite}, ${p.laeufe} Laeufe, Strom ${p.saatVersatz}): ${p.abweichungPp}  [${p.reihen.map((r) => `${r.attribut} ${r.anteil}`).join(", ")}]  (${p.sekunden.toFixed(0)} s)`);
}
if (ausgabe.pp) console.log("Schranke Pp (CLAUDE.md): <= 25 in zwei Saatstroemen.");
console.log(`Seitenfehler: ${fehler.length ? fehler.join(" | ") : "keine"}`);
if (JSON_AUS) writeFileSync(JSON_AUS, JSON.stringify(ausgabe, null, 2));
