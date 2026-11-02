// ===================================================================================
// BATTLEFIELD-POD-FFA-ABNAHME — Rangtreue des ECHTEN Vier-Team-Kampfes (02.11.).
//
// Chris (01./02.11.): „nein auch bei battlefield reicht kein hinweistext! da sollen 4 teams
// gleichzeitig FFA machen". Seit 02.11. laufen im Motor alle vier Pod-Teams gleichzeitig im
// selben Echtzeitkampf um die drei Orte (`window.__arena.battlefieldPodSonde`,
// battle-mode.engine.js, s. bfPodLauf). Dieses Skript misst ihn nach demselben Muster wie
// scripts/miss-bahn-pod-abnahme.mjs (Takeshi/Staffel im Pod-Format):
//
//  - rho je Kampf zwischen `eig` (ohne Mutator) und MOTOREN.battlefield.wert() (Anteil am
//    Gesamtbeitrag) ueber ALLE 4k Kaempfer — dieselbe Groesse wie disziplinProbe im Duell.
//    Kaderfest: die zehn ECHTEN Team-Kader der Kader-Familie (data/generated/kaderfamilie-
//    live-save.json), Vierergruppen daraus. Abnahmezahl = Median ueber die Gruppen des
//    Gruppenmittels, dazu Mittel, Spannweite, Gruppen unter 0,80, Saison-Validitaet.
//  - die ehrlicheren Abnahmen aus CLAUDE.md: Star auf Rang 1 / unter den ersten zwei,
//    Paartreue nach Eignungsabstand.
//  - TEAM-EBENE (das, was die Liga bucht: Platz 1..4, 2-1-0-0): rho Teameignung gegen Platz,
//    wie oft das eignungsstaerkste Team gewinnt / Letzter wird — der Abgleich mit der PPS-
//    Wertung, die den Pod bucht (die rangiert nach Teameignung, s. Abschnitt 4 der Notiz).
//  - Wie die Kaempfe enden (letztes Team steht / Punktelimit / Zeit) und wie lange sie dauern.
//
// KONTROLLE IM SELBEN LAUF (`--kontrolle`): dieselbe Kadergroesse im Duell
// (`disziplinProbe("battlefield", {kaderFamilie, jeSeite})`), damit der Abstand Duell -> Pod
// mit denselben Kadern gemessen ist.
//
// PP (`--pp[=laeufe]`, Budget-Methode, Pflicht nach CLAUDE.md): `window.__arena.
// battlefieldPodEinfluss` — exakt einflussVon(), nur als Vier-Team-Kampf (SQUAD/OPP als
// Messpersonen plus zwei Familien-Teams als Feld). Ziel <= 25 Pp in beiden Saatstroemen.
//
//   node scripts/miss-battlefield-pod-ffa-abnahme.mjs [kaempfe je Gruppe] [--je-seite=2..6]
//        [--gruppen=<anzahl, Standard 30 von 210>] [--kontrolle] [--stroeme=0,10000000]
//        [--pp[=24]] [--pp-je-seite=k] [--nur-pp] [--json=<datei>]
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
  if (!roh) return [4];
  const b = roh.match(/^(\d+)\.\.(\d+)$/);
  if (b) return Array.from({ length: Number(b[2]) - Number(b[1]) + 1 }, (_, i) => Number(b[1]) + i);
  return roh.split(",").map(Number);
}
const JE_SEITE = parseListe(wert("je-seite"));
const GRUPPEN_ANZAHL = Number(wert("gruppen") || 30);
const KONTROLLE = hat("kontrolle");
const MIT_PP = hat("pp") || args.some((x) => x.startsWith("--pp=")) || hat("nur-pp");
const PP_LAEUFE = Number(wert("pp") || 24);
const NUR_PP = hat("nur-pp");
const PP_JE_SEITE = Number(wert("pp-je-seite") || 0) || undefined;

// --- Kader: zehn Teams aus der Familie ------------------------------------------------
const familie = JSON.parse(readFileSync(path.join(WURZEL, "data/generated/kaderfamilie-live-save.json"), "utf8"));
const teamsNachName = new Map();
for (const v of familie.varianten) {
  if (!teamsNachName.has(v.heimName)) teamsNachName.set(v.heimName, v.heim);
  if (!teamsNachName.has(v.gastName)) teamsNachName.set(v.gastName, v.gast);
}
const TEAMNAMEN = [...teamsNachName.keys()];
const KADER = TEAMNAMEN.map((n) => teamsNachName.get(n));
const T = KADER.length;
const ALLE4 = [];
for (let a = 0; a < T; a++) for (let b = a + 1; b < T; b++) for (let c = b + 1; c < T; c++) for (let d = c + 1; d < T; d++) ALLE4.push([a, b, c, d]);
// Deterministische, gleichmaessig gestreute Auswahl (jede k-te Gruppe), damit jedes Team gleich
// oft vorkommt und die Laufzeit beherrschbar bleibt (ein Vier-Team-Kampf mit 6 je Seite kostet
// ~0,3 s Rechenzeit).
const schritt = Math.max(1, Math.floor(ALLE4.length / Math.max(1, GRUPPEN_ANZAHL)));
const GRUPPEN4 = ALLE4.filter((_, i) => i % schritt === 0).slice(0, GRUPPEN_ANZAHL);

// --- Auswertung --------------------------------------------------------------------------
const mittel = (a) => { const b = a.filter((v) => Number.isFinite(v)); return b.reduce((x, y) => x + y, 0) / Math.max(1, b.length); };
function auswerten(events) {
  const jeGruppe = new Map();
  const saison = new Map();
  let star1 = 0, star2 = 0, starLetzt = 0, teamBesterGewinnt = 0, teamBesterLetzter = 0, teamBesterOben2 = 0;
  const paar = { gross: [0, 0], mittel: [0, 0], klein: [0, 0] };
  const teamRho = [];
  const enden = { allein: 0, limit: 0, zeit: 0 };
  const dauer = [];
  for (const ev of events) {
    const t = ev.teilnehmer;
    (jeGruppe.get(ev.gruppe) || jeGruppe.set(ev.gruppe, []).get(ev.gruppe)).push(rho(t.map((x) => ({ eig: x.eig, wert: x.wert }))));
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
    const teamEig = ev.teams.map((tm) => mittel(t.filter((x) => x.side === tm.side).map((x) => x.eig)));
    teamRho.push(rho(ev.teams.map((tm, i) => ({ eig: teamEig[i], wert: -tm.eventPlatz }))));
    const bester = teamEig.indexOf(Math.max(...teamEig));
    if (ev.teams[bester].eventPlatz === 1) teamBesterGewinnt++;
    if (ev.teams[bester].eventPlatz <= 2) teamBesterOben2++;
    if (ev.teams[bester].eventPlatz === N) teamBesterLetzter++;
    const lebendeTeams = ev.teams.filter((tm) => tm.lebend > 0).length;
    if (lebendeTeams <= 1) enden.allein++;
    else if (Math.max(...ev.teams.map((tm) => tm.punkte)) >= 150) enden.limit++;
    else enden.zeit++;
    dauer.push(ev.dauer);
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
    star1: (100 * star1) / E, star2: (100 * star2) / E, starLetzt: (100 * starLetzt) / E,
    paarGross: q(paar.gross), paarMittel: q(paar.mittel), paarKlein: q(paar.klein),
    teamRho: mittel(teamRho), teamBesterGewinnt: (100 * teamBesterGewinnt) / E,
    teamBesterOben2: (100 * teamBesterOben2) / E, teamBesterLetzter: (100 * teamBesterLetzter) / E,
    endeAllein: (100 * enden.allein) / E, endeLimit: (100 * enden.limit) / E, endeZeit: (100 * enden.zeit) / E,
    dauerMittel: mittel(dauer),
  };
}

const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
const ausgabe = { disziplin: "battlefield", format: "pod-ffa", spiele: SPIELE, stroeme: STROEME, teams: TEAMNAMEN, gruppen: GRUPPEN4, laeufe: [], kontrolle: [] };
const fehler = [];
try {
  const seite = await browser.newPage();
  // SPEICHERLECK-SCHUTZ wie messe-arena-einfluss.mjs / miss-bahn-pod-abnahme.mjs: ohne
  // AudioContext ist sfx() ein No-Op, waehrend der langen synchronen Aufrufe ist setTimeout still.
  await seite.addInitScript(() => { window.AudioContext = undefined; window.webkitAudioContext = undefined; });
  seite.on("pageerror", (e) => fehler.push(String(e)));
  await seite.goto(SEITE, { waitUntil: "networkidle" });
  await seite.waitForFunction(() => window.__arena && window.__arena.battlefieldPodSonde, null, { timeout: 60000 });
  if (!NUR_PP) for (const js of JE_SEITE) {
    for (const versatz of STROEME) {
      const t0 = Date.now();
      const roh = await seite.evaluate(([kader, gruppen, n, versatz, js]) => {
        const st = window.setTimeout; window.setTimeout = () => 0;
        try { return window.__arena.battlefieldPodSonde(kader, { gruppen, n, versatz, jeSeite: js }); }
        finally { window.setTimeout = st; }
      }, [KADER, GRUPPEN4, SPIELE, versatz, js]);
      const sek = (Date.now() - t0) / 1000;
      ausgabe.laeufe.push({ format: "pod (N=4)", jeSeite: js, versatz, sekunden: sek, msJeKampf: (1000 * sek) / roh.events.length, ...auswerten(roh.events) });
      if (KONTROLLE) {
        const k = await seite.evaluate(([fam, n, versatz, js]) => {
          const st = window.setTimeout; window.setTimeout = () => 0;
          try {
            const A = window.__arena, aus = [];
            for (const v of fam) {
              A.kaderSetzen({ heim: v.heim, gast: v.gast });
              const p = A.disziplinProbe("battlefield", { n, saat0: 1337 + versatz, jeSeite: js });
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
    for (const versatz of STROEME) {
      const t0 = Date.now();
      const r = await seite.evaluate(([extra, n, v, js]) => {
        const st = window.setTimeout; window.setTimeout = () => 0;
        try { return window.__arena.battlefieldPodEinfluss(extra, n, undefined, v, undefined, js); }
        finally { window.setTimeout = st; }
      }, [[KADER[0], KADER[1]], PP_LAEUFE, versatz, PP_JE_SEITE]);
      ausgabe.pp.push({ ...r, sekunden: (Date.now() - t0) / 1000 });
    }
  }
} finally {
  await browser.close();
}

const f3 = (v) => (Number.isFinite(v) ? v.toFixed(3) : "  —  ");
const f1 = (v) => (Number.isFinite(v) ? v.toFixed(1) : " — ");
console.log(`Battlefield-Pod-FFA-Abnahme — ${SPIELE} Kaempfe je Gruppe, ${GRUPPEN4.length} von ${ALLE4.length} Vierergruppen, Saatstroeme ${STROEME.join(" / ")}`);
console.log(`Kader: ${TEAMNAMEN.length} Teams der Kader-Familie\n`);
console.log("k  Strom     rho/Kampf Median  Mittel  min..max       <0,80  Saison  Star#1  Star<=2  letzt  Paar>=15  Team-rho  bestesTeam 1./<=2./4.   Ende allein/limit/zeit  Dauer  ms/Kampf");
for (const l of ausgabe.laeufe) {
  console.log(
    `${String(l.jeSeite).padEnd(2)} ${String(l.versatz).padEnd(9)} ${f3(l.rhoMedian).padStart(16)}  ${f3(l.rhoMittel)}  ${f3(l.rhoMin)}..${f3(l.rhoMax)}  ${String(l.gruppenUnter80).padStart(3)}/${l.gruppen}  ${f3(l.rhoSaison)}  ${f1(l.star1).padStart(6)}  ${f1(l.star2).padStart(7)}  ${f1(l.starLetzt).padStart(5)}  ${f1(l.paarGross).padStart(8)}  ${f3(l.teamRho).padStart(8)}  ${f1(l.teamBesterGewinnt).padStart(6)}/${f1(l.teamBesterOben2)}/${f1(l.teamBesterLetzter)}  ${f1(l.endeAllein).padStart(10)}/${f1(l.endeLimit)}/${f1(l.endeZeit)}  ${f1(l.dauerMittel).padStart(5)}  ${l.msJeKampf.toFixed(0).padStart(7)}`,
  );
}
for (const k of ausgabe.kontrolle) console.log(`Kontrolle Duell k=${k.jeSeite} Strom ${k.versatz}: rho/Spiel Median ${f3(k.rhoMedian)}, Mittel ${f3(k.rhoMittel)}  [${k.jeVariante.map(f3).join(" ")}]`);
console.log("Schranke (CLAUDE.md): rho je Spiel ueber 0,80, angestrebt 0,85.");
for (const p of ausgabe.pp || []) {
  console.log(`Pp-Abweichung (Pod, ${p.teams} Teams, k=${p.jeSeite}, ${p.laeufe} Laeufe, Strom ${p.saatVersatz}): ${p.abweichungPp}  [${p.reihen.map((r) => `${r.attribut} ${r.anteil}`).join(", ")}]  (${p.sekunden.toFixed(0)} s)`);
}
if (ausgabe.pp) console.log("Schranke Pp (CLAUDE.md): <= 25 in zwei Saatstroemen.");
console.log(`Seitenfehler: ${fehler.length ? fehler.join(" | ") : "keine"}`);
if (JSON_AUS) writeFileSync(JSON_AUS, JSON.stringify(ausgabe, null, 2));
