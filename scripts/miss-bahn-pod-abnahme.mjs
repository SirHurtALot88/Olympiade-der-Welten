// ===================================================================================
// BAHN-POD-ABNAHME — Rangtreue im 4-Team-Format fuer Takeshi's Castle und Staffel (01.11.).
//
// Warum ein eigenes Skript: `miss-alle-disziplinen.mjs` misst die Bahn als Duell (SQUAD gegen
// OPP, `disziplinProbe`). Im Pod-Format laufen VIER Teams auf derselben Strecke
// (`window.__arena.bahnPodSonde`, battle-mode.engine.js) — dafuer braucht es dieselbe Messung
// mit vier Kadern, nach dem Muster von `miss-mini-dm-ffa-abnahme.mjs`.
//
// DIESELBE MESSGROESSE WIE DIE DUELL-ABNAHME: rho je Rennen zwischen `eig` (ohne Mutator) und
// `MOTOREN[bd].wert()` ueber ALLE Laeufer des Rennens (im Duell 12, im Pod 24), Formkarten je
// Rennen, Mutatoren "je-spiel". Kaderfest: die zehn ECHTEN Team-Kader der Kader-Familie
// (data/generated/kaderfamilie-live-save.json), jede der C(10,4) = 210 Vierergruppen faehrt
// `spiele` Rennen je Saatstrom. Abnahmezahl = Median ueber die Gruppen des Gruppenmittels
// (im Duell: Median ueber die fuenf Paarungen) — dazu Mittel, Spannweite, Gruppen unter 0,80.
//
// KONTROLLE IM SELBEN LAUF: `--kontrolle` faehrt dieselbe Sonde mit N=2 auf den fuenf Paarungen
// der Familie — damit ist der Abstand Duell -> Pod mit derselben Sonde gemessen, nicht gegen
// eine Zahl aus einem anderen Skript.
//
// Dazu die ehrlicheren Abnahmen aus CLAUDE.md: Star (hoechste Eignung im Rennen) auf Rang 1 /
// unter den ersten zwei — ueber 24 Laeufer eine viel haertere Huerde als ueber 12 —, Paartreue
// nach Eignungsabstand, und auf Team-Ebene: rho Teameignung gegen Platz, wie oft das
// eignungsstaerkste Team gewinnt.
//
// PP-ABNAHME (`--pp[=laeufe]`, Budget-Methode, Pflicht nach CLAUDE.md): `window.__arena.
// bahnPodEinfluss` — exakt einflussVon() (messe-arena-einfluss.mjs), nur als Vier-Team-Rennen:
// die zwoelf Messpersonen der Duell-Abnahme (SQUAD/OPP) plus zwei Teams der Kader-Familie als
// Feld. Ziel <= 25 Pp in beiden Saatstroemen. `--nur-pp` laesst die Rangtreue weg.
//
//   node scripts/miss-bahn-pod-abnahme.mjs <disziplin> [spiele] [--je-seite=2..6]
//        [--kontrolle] [--stroeme=0,10000000] [--pp[=48]] [--nur-pp]
//        [--json=<datei>] [--seite=<battle-mode.html>]
//
// <disziplin>: takeshis-castle | staffel. Ohne --je-seite: art.jeSeite (6).
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
const DISZIPLIN = positionen[0];
if (!["takeshis-castle", "staffel"].includes(DISZIPLIN)) {
  throw new Error(`Disziplin muss takeshis-castle oder staffel sein, bekam "${DISZIPLIN}".`);
}
const SPIELE = Number(positionen[1] || 6);
const SEITE = pathToFileURL(wert("seite") || path.join(WURZEL, "public/mockups/battle-mode.html")).href;
const JSON_AUS = wert("json");
const STROEME = (wert("stroeme") || "0,10000000").split(",").map(Number);
function parseListe(roh) {
  if (!roh) return [null];
  const b = roh.match(/^(\d+)\.\.(\d+)$/);
  if (b) return Array.from({ length: Number(b[2]) - Number(b[1]) + 1 }, (_, i) => Number(b[1]) + i);
  return roh.split(",").map(Number);
}
const JE_SEITE = parseListe(wert("je-seite"));
const KONTROLLE = hat("kontrolle");
const MIT_PP = hat("pp") || args.some((x) => x.startsWith("--pp=")) || hat("nur-pp");
const PP_LAEUFE = Number(wert("pp") || 48);
const NUR_PP = hat("nur-pp");

// --- Kader: zehn Teams aus der Familie --------------------------------------------
const familie = JSON.parse(readFileSync(path.join(WURZEL, "data/generated/kaderfamilie-live-save.json"), "utf8"));
const teamsNachName = new Map();
for (const v of familie.varianten) {
  if (!teamsNachName.has(v.heimName)) teamsNachName.set(v.heimName, v.heim);
  if (!teamsNachName.has(v.gastName)) teamsNachName.set(v.gastName, v.gast);
}
const TEAMNAMEN = [...teamsNachName.keys()];
const KADER = TEAMNAMEN.map((n) => teamsNachName.get(n));
const T = KADER.length;
const GRUPPEN4 = [];
for (let a = 0; a < T; a++) for (let b = a + 1; b < T; b++) for (let c = b + 1; c < T; c++) for (let d = c + 1; d < T; d++) GRUPPEN4.push([a, b, c, d]);
const GRUPPEN2 = familie.varianten.map((v) => [TEAMNAMEN.indexOf(v.heimName), TEAMNAMEN.indexOf(v.gastName)]);

// --- Auswertung ----------------------------------------------------------------------
const ev0N = (events) => (events[0] ? events[0].teams.length : 0);
const mittel = (a) => { const b = a.filter((v) => !Number.isNaN(v)); return b.reduce((x, y) => x + y, 0) / Math.max(1, b.length); };
function auswerten(events) {
  const jeGruppe = new Map();
  const saison = new Map();
  let star1 = 0, star2 = 0, starLetzt = 0, starAnteilOben = 0, teamBesterGewinnt = 0, teamBesterLetzter = 0;
  const paar = { gross: [0, 0], mittel: [0, 0], klein: [0, 0] };
  const teamRho = [];
  let laeufer = 0, raus = 0, ohneZiel = 0, teamsOhneZiel = 0, teamsGesamt = 0;
  for (const ev of events) {
    const t = ev.teilnehmer;
    const v = rho(t.map((x) => ({ eig: x.eig, wert: x.wert })));
    (jeGruppe.get(ev.gruppe) || jeGruppe.set(ev.gruppe, []).get(ev.gruppe)).push(v);
    // Rang nach wert (1 = bester), Gleichstand: bester geteilter Rang.
    const sortiert = [...t].sort((a, b) => b.wert - a.wert);
    const rangVon = (x) => sortiert.findIndex((y) => y.wert === x.wert) + 1;
    const star = [...t].sort((a, b) => b.eig - a.eig)[0];
    const sr = rangVon(star);
    if (sr === 1) star1++;
    if (sr <= 2) star2++;
    if (sr === t.length) starLetzt++;
    if (sr <= Math.ceil(t.length / 4)) starAnteilOben++;
    for (let i = 0; i < t.length; i++) for (let j = i + 1; j < t.length; j++) {
      const [a, b] = [t[i], t[j]];
      const ab = Math.abs(a.eig - b.eig);
      const korb = ab >= 15 ? paar.gross : ab >= 5 ? paar.mittel : paar.klein;
      const besser = a.eig >= b.eig ? a : b, schlechter = besser === a ? b : a;
      korb[0] += besser.wert > schlechter.wert ? 1 : besser.wert === schlechter.wert ? 0.5 : 0;
      korb[1]++;
    }
    for (const x of t) {
      laeufer++; if (x.raus) raus++; if (x.fertig == null) ohneZiel++;
      const sk = ev.teamsIx[x.side] + ":" + x.n;
      const s = saison.get(sk) || { eig: 0, wert: 0, k: 0 }; s.eig += x.eig; s.wert += x.wert; s.k++; saison.set(sk, s);
    }
    const N = ev.teams.length;
    const teamEig = ev.teams.map((tm) => mittel(t.filter((x) => x.side === tm.side).map((x) => x.eig)));
    teamRho.push(rho(ev.teams.map((tm, i) => ({ eig: teamEig[i], wert: -tm.eventPlatz }))));
    const bester = teamEig.indexOf(Math.max(...teamEig));
    if (ev.teams[bester].eventPlatz === 1) teamBesterGewinnt++;
    if (ev.teams[bester].eventPlatz === N) teamBesterLetzter++;
    for (const tm of ev.teams) { teamsGesamt++; if (DISZIPLIN === "staffel" && tm.zielzeit == null) teamsOhneZiel++; }
  }
  const gruppenMittel = [...jeGruppe.values()].map((l) => mittel(l));
  const E = events.length;
  const q = (k) => (k[1] ? (100 * k[0]) / k[1] : NaN);
  return {
    events: E, gruppen: gruppenMittel.length,
    rhoMedian: median(gruppenMittel), rhoMittel: mittel(gruppenMittel),
    rhoMin: Math.min(...gruppenMittel), rhoMax: Math.max(...gruppenMittel),
    gruppenUnter80: gruppenMittel.filter((v) => v < 0.8).length,
    rhoSaison: rho([...saison.values()].map((s) => ({ eig: s.eig / s.k, wert: s.wert / s.k }))),
    star1: (100 * star1) / E, star2: (100 * star2) / E, starLetzt: (100 * starLetzt) / E, starOberesViertel: (100 * starAnteilOben) / E,
    paarGross: q(paar.gross), paarMittel: q(paar.mittel), paarKlein: q(paar.klein),
    teamRho: ev0N(events) >= 3 ? mittel(teamRho) : NaN, teamBesterGewinnt: (100 * teamBesterGewinnt) / E, teamBesterLetzter: (100 * teamBesterLetzter) / E,
    ausgeschieden: (100 * raus) / laeufer, ohneZiel: (100 * ohneZiel) / laeufer,
    teamsOhneZiel: teamsGesamt ? (100 * teamsOhneZiel) / teamsGesamt : 0,
  };
}

const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
const ausgabe = { disziplin: DISZIPLIN, spiele: SPIELE, stroeme: STROEME, teams: TEAMNAMEN, laeufe: [] };
const fehler = [];
try {
  const seite = await browser.newPage();
  // SPEICHERLECK-SCHUTZ wie messe-arena-einfluss.mjs (dort ausfuehrlich begruendet): ohne
  // AudioContext ist sfx() ein No-Op, und waehrend der langen synchronen Aufrufe ist setTimeout
  // stillgelegt (`ohneTimer` unten). Ohne beides stapelten sich bei der Staffel-Pp-Sonde (n=48,
  // ~7000 Rennen in EINEM evaluate) Audio-Knoten und Timer, bis der Renderer starb
  // ("Target page, context or browser has been closed"), 01.11. nachgemessen. Die Ton- und
  // Anzeige-Schicht ruft nie rr() und schreibt nie auf Teilnehmer: die Messwerte bleiben gleich.
  await seite.addInitScript(() => {
    window.AudioContext = undefined;
    window.webkitAudioContext = undefined;
  });
  seite.on("pageerror", (e) => fehler.push(String(e)));
  await seite.goto(SEITE, { waitUntil: "networkidle" });
  await seite.waitForFunction(() => window.__arena && window.__arena.bahnPodSonde, null, { timeout: 30000 });
  const faelle = [];
  if (!NUR_PP) for (const js of JE_SEITE) {
    if (KONTROLLE) faelle.push({ format: "duell (N=2, Familienpaarungen)", gruppen: GRUPPEN2, js });
    faelle.push({ format: "pod (N=4, alle 210 Gruppen)", gruppen: GRUPPEN4, js });
  }
  for (const fall of faelle) {
    for (const versatz of STROEME) {
      const t0 = Date.now();
      const roh = await seite.evaluate(([d, kader, gruppen, n, versatz, js]) => {
        const st = window.setTimeout;
        window.setTimeout = () => 0;
        try {
          return window.__arena.bahnPodSonde(d, kader, { gruppen, n, versatz, ...(js ? { jeSeite: js } : {}) });
        } finally {
          window.setTimeout = st;
        }
      }, [DISZIPLIN, KADER, fall.gruppen, SPIELE, versatz, fall.js]);
      const sek = (Date.now() - t0) / 1000;
      const e = auswerten(roh.events);
      ausgabe.laeufe.push({ format: fall.format, jeSeite: fall.js ?? "art.jeSeite", versatz, sekunden: sek, msJeRennen: (1000 * sek) / roh.events.length, ...e });
    }
  }
  if (MIT_PP) {
    ausgabe.pp = [];
    for (const versatz of STROEME) {
      const t0 = Date.now();
      const r = await seite.evaluate(([d, extra, n, v]) => {
        const st = window.setTimeout;
        window.setTimeout = () => 0;
        try {
          return window.__arena.bahnPodEinfluss(d, extra, n, undefined, v);
        } finally {
          window.setTimeout = st;
        }
      }, [DISZIPLIN, [KADER[0], KADER[1]], PP_LAEUFE, versatz]);
      ausgabe.pp.push({ ...r, sekunden: (Date.now() - t0) / 1000 });
    }
  }
} finally {
  await browser.close();
}

const f3 = (v) => (Number.isFinite(v) ? v.toFixed(3) : "  —  ");
const f1 = (v) => (Number.isFinite(v) ? v.toFixed(1) : " — ");
console.log(`Bahn-Pod-Abnahme ${DISZIPLIN} — ${SPIELE} Rennen je Gruppe, Saatstroeme ${STROEME.join(" / ")}`);
console.log(`Kader: ${TEAMNAMEN.length} Teams der Kader-Familie (${familie.quelle?.saveName ?? "?"})\n`);
console.log("Format                              je Team  Strom      rho/Rennen Median  Mittel  min..max        <0,80  rho Saison  Star#1  Star<=2  Star letzt  Paar>=15  Team-rho  bestes Team gewinnt  ms/Rennen");
for (const l of ausgabe.laeufe) {
  console.log(
    `${l.format.padEnd(36)}${String(l.jeSeite).padStart(7)}  ${String(l.versatz).padEnd(9)}  ${f3(l.rhoMedian).padStart(17)}  ${f3(l.rhoMittel)}  ${f3(l.rhoMin)}..${f3(l.rhoMax)}  ${String(l.gruppenUnter80).padStart(3)}/${l.gruppen}  ${f3(l.rhoSaison).padStart(9)}  ${f1(l.star1).padStart(6)}  ${f1(l.star2).padStart(7)}  ${f1(l.starLetzt).padStart(10)}  ${f1(l.paarGross).padStart(8)}  ${f3(l.teamRho).padStart(8)}  ${f1(l.teamBesterGewinnt).padStart(19)}  ${l.msJeRennen.toFixed(0).padStart(9)}`,
  );
}
console.log(`\nAusgeschieden/ohne Ziel (Laeufer, %): ${ausgabe.laeufe.map((l) => `${f1(l.ausgeschieden)}/${f1(l.ohneZiel)}`).join("  ")}`);
if (DISZIPLIN === "staffel") console.log(`Teams ohne Zieleinlauf (%): ${ausgabe.laeufe.map((l) => f1(l.teamsOhneZiel)).join("  ")}`);
console.log("Schranke (CLAUDE.md): rho je Rennen ueber 0,80, angestrebt 0,85.");
for (const p of ausgabe.pp || []) {
  console.log(`Pp-Abweichung (Pod, ${p.teams} Teams, ${p.laeufe} Laeufe, Strom ${p.saatVersatz}): ${p.abweichungPp}  [${p.reihen.map((r) => `${r.attribut} ${r.anteil}`).join(", ")}]  (${p.sekunden.toFixed(0)} s)`);
}
if (ausgabe.pp) console.log("Schranke Pp (CLAUDE.md): <= 25 in zwei Saatstroemen.");
console.log(`Seitenfehler: ${fehler.length ? fehler.join(" | ") : "keine"}`);
if (JSON_AUS) writeFileSync(JSON_AUS, JSON.stringify(ausgabe, null, 2));
