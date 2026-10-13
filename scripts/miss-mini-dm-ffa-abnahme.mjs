// ===================================================================================
// MINI-DM-FFA-ABNAHME — Rangtreue UND Pp auf dem Format, das gespielt wird (13.10.).
//
// Warum ein eigenes Skript: `miss-alle-disziplinen.mjs`/`messe-arena-einfluss.mjs` messen
// fuer Mini-DM `MOTOREN["mini-dm"]`, das generische 4-gegen-4 aus build(). Gespielt wird aber
// das 4-Team-FFA (vier Teams, je ein Kaempfer, vier Rollenrunden) — `spieleMiniDmFfaEvent()`.
// Das Nachtkonzept (docs/design/mini-dm-nachtkonzept-03-10.md, Paket P0) hat genau diese
// Luecke benannt; die Scratch-Sonden von damals sind hier die Vorlage, jetzt im Repo.
//
// KADERFEST wie die uebrigen Abnahmen: die zehn ECHTEN Team-Kader der Kader-Familie
// (data/generated/kaderfamilie-live-save.json, fuenf Paarungen = zehn Teams). Jede der
// C(10,4) = 210 Vierergruppen spielt `spiele` Events je Saatstrom; je Event vier Runden.
//
// EIGNUNG UNTER DEM OVERRIDE. Die Kader-Familie traegt `d["mini-dm"]` so, wie der Spielstand
// es am 03.09. unter der MATRIX rechnete. Seit Chris' Override (lib/player-generator/
// spiel-eignung-overrides.ts, 13.10.) gewichtet die Eignung anders — im Spiel rechnet
// buildLeagueDisciplineRatingsForPlayers() die Zahl ueber den Liga-Rang neu. Dieses Skript
// bildet das nach, ohne den Spielstand zu brauchen: die 110 Spieler der Familie liefern die
// monotone Kurve „gewichtete Rohsumme unter der Matrix -> d", und die neue Rohsumme (unter
// den Gewichten, die der Motor in BASIS_JE_DISC fuehrt) wird auf derselben Kurve abgelesen.
// Stimmen Motor-Gewichte und Matrix ueberein (Vorher-Messung), bleibt d unveraendert.
//
//   node scripts/miss-mini-dm-ffa-abnahme.mjs [spiele] [--pp[=laeufe]] [--nur-pp]
//        [--ohne-rangtreue] [--seite=<pfad zu battle-mode.html>] [--param='<json>']
//        [--json=<datei>]
//
// Ohne Schalter: Rangtreue, zwei Saatstroeme (Versatz 0 und 10 000 000), 6 Events je Gruppe.
// --pp misst zusaetzlich die Pp-Abweichung (Budget-Methode, +15) in beiden Stroemen.
// --param setzt Schlagwechsel-Parameter nur fuer diese Messung (window.__arena.miniDmFfaParameter).
// --seite misst einen anderen Motorstand (z. B. eine Kopie von origin/main fuer „vorher").
// ===================================================================================
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { rho, median, spannweite } from "./lib/rangtreue-messung.mjs";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const wert = (name) => { const a = args.find((x) => x.startsWith(`--${name}=`)); return a ? a.slice(name.length + 3) : null; };
const hat = (name) => args.includes(`--${name}`) || args.some((x) => x.startsWith(`--${name}=`));
const positionen = args.filter((a) => !a.startsWith("--"));
const SPIELE = Number(positionen[0] || 6);
const MIT_PP = hat("pp") || hat("nur-pp");
const PP_LAEUFE = Number(wert("pp") || 2);
const NUR_PP = hat("nur-pp") || hat("ohne-rangtreue");
const SEITE = pathToFileURL(wert("seite") || path.join(WURZEL, "public/mockups/battle-mode.html")).href;
const PARAM = wert("param") ? JSON.parse(wert("param")) : null;
const JSON_AUS = wert("json");
const STROEME = [0, 10_000_000];
const MATRIX_MINI_DM = { torment: 24, health: 20, power: 16, stamina: 16, will: 14, dexterity: 10 };

// --- Kader: zehn Teams aus der Familie --------------------------------------------
const familie = JSON.parse(readFileSync(path.join(WURZEL, "data/generated/kaderfamilie-live-save.json"), "utf8"));
const teamsNachName = new Map();
for (const v of familie.varianten) {
  if (!teamsNachName.has(v.heimName)) teamsNachName.set(v.heimName, v.heim);
  if (!teamsNachName.has(v.gastName)) teamsNachName.set(v.gastName, v.gast);
}
const TEAMNAMEN = [...teamsNachName.keys()];
const roheKader = TEAMNAMEN.map((n) => teamsNachName.get(n));
const GRUPPEN = [];
for (let a = 0; a < 10; a++) for (let b = a + 1; b < 10; b++) for (let c = b + 1; c < 10; c++) for (let d = c + 1; d < 10; d++) GRUPPEN.push([a, b, c, d]);

function rohsumme(a, w) { let s = 0, g = 0; for (const k in w) { s += (a[k] || 0) * w[k]; g += w[k]; } return g ? s / g : 0; }
function eignungNeu(kader, gewichte) {
  const gleich = Object.keys({ ...gewichte, ...MATRIX_MINI_DM }).every((k) => (gewichte[k] || 0) === (MATRIX_MINI_DM[k] || 0));
  if (gleich) return kader;
  const punkte = [];
  for (const k of kader) for (const p of k) punkte.push([rohsumme(p.a, MATRIX_MINI_DM), p.d["mini-dm"]]);
  punkte.sort((x, y) => x[0] - y[0]);
  const lies = (x) => {
    if (x <= punkte[0][0]) return punkte[0][1] + (x - punkte[0][0]) * ((punkte[1][1] - punkte[0][1]) / Math.max(1e-9, punkte[1][0] - punkte[0][0]));
    const l = punkte.length - 1;
    if (x >= punkte[l][0]) return punkte[l][1] + (x - punkte[l][0]) * ((punkte[l][1] - punkte[l - 1][1]) / Math.max(1e-9, punkte[l][0] - punkte[l - 1][0]));
    let i = 1; while (punkte[i][0] < x) i++;
    const [x0, y0] = punkte[i - 1], [x1, y1] = punkte[i];
    return x1 === x0 ? (y0 + y1) / 2 : y0 + (y1 - y0) * (x - x0) / (x1 - x0);
  };
  return kader.map((k) => k.map((p) => ({ ...p, d: { ...p.d, "mini-dm": Math.round(lies(rohsumme(p.a, gewichte)) * 100) / 100 } })));
}

// --- Auswertung ----------------------------------------------------------------------
function auswertenFfa(events) {
  const jeRunde = [], jeEvent = [], jeEventAbs = [], teamRho = [];
  const jeGruppe = new Map(); // gruppe -> [rho je Runde]
  const mech = { buendnisse: 0, schwachstellen: 0, ausgewichen: 0, finishes: 0, ueberstanden: 0, kos: 0, beute: 0, mit: false };
  let star1 = 0, star2 = 0, starLetzt = 0, runden = 0, raus = 0, kaempfer = 0, takte = 0;
  const paar = { gross: [0, 0], mittel: [0, 0], klein: [0, 0] };
  const jeGruppeRunde = new Map();
  const saison = new Map();
  for (const ev of events) {
    const alle = [], alleAbs = [];
    ev.runden.forEach((r, ri) => {
      const t = r.teilnehmer;
      const summe = t.reduce((a, x) => a + x.wert, 0) || 1;
      const v = rho(t.map((x) => ({ eig: x.eig, wert: x.wert })));
      if (!Number.isNaN(v)) { jeRunde.push(v); (jeGruppe.get(ev.gruppe) || jeGruppe.set(ev.gruppe, []).get(ev.gruppe)).push(v); }
      for (const x of t) if (x.st) {
        mech.mit = true; mech.buendnisse += x.st.buendnisse / 2; mech.schwachstellen += x.st.schwachstellen;
        mech.ausgewichen += x.st.ausgewichen; mech.finishes += x.st.finishes; mech.ueberstanden += x.st.ueberstanden;
        mech.kos += x.st.kos; mech.beute += x.st.beute || 0;
      }
      const star = t.slice().sort((a, b) => b.eig - a.eig)[0];
      runden++; takte += r.takte;
      if (star.platz === 1) star1++;
      if (star.platz <= 2) star2++;
      if (star.platz === 4) starLetzt++;
      for (const x of t) { kaempfer++; if (x.raus) raus++; alle.push({ eig: x.eig, wert: x.wert / summe }); alleAbs.push({ eig: x.eig, wert: x.wert }); }
      for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
        const [a, b] = [t[i], t[j]];
        const ab = Math.abs(a.eig - b.eig);
        const korb = ab >= 15 ? paar.gross : ab >= 5 ? paar.mittel : paar.klein;
        const besser = a.eig >= b.eig ? a : b, schlechter = besser === a ? b : a;
        korb[0] += besser.wert > schlechter.wert ? 1 : besser.wert === schlechter.wert ? 0.5 : 0;
        korb[1]++;
      }
      const key = ev.gruppe + ":" + ri;
      const g = jeGruppeRunde.get(key) || new Map();
      for (const x of t) { const e = g.get(x.side) || { eig: 0, wert: 0, k: 0 }; e.eig += x.eig; e.wert += x.wert / summe; e.k++; g.set(x.side, e); }
      jeGruppeRunde.set(key, g);
      for (const x of t) {
        const sk = ev.teamsIx[x.side] + ":" + x.n;
        const s = saison.get(sk) || { eig: 0, wert: 0, k: 0 }; s.eig += x.eig; s.wert += x.wert / summe; s.k++; saison.set(sk, s);
      }
    });
    jeEvent.push(rho(alle)); jeEventAbs.push(rho(alleAbs));
    const teamEig = [0, 1, 2, 3].map((side) => ev.runden.reduce((a, r) => a + r.teilnehmer.find((x) => x.side === side).eig, 0));
    teamRho.push(rho([0, 1, 2, 3].map((side) => ({ eig: teamEig[side], wert: -ev.teams.find((t) => t.side === side).eventPlatz }))));
  }
  const validitaet = [...jeGruppeRunde.values()].map((g) => rho([...g.values()].map((e) => ({ eig: e.eig / e.k, wert: e.wert / e.k })))).filter((v) => !Number.isNaN(v));
  const mittel = (a) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
  const q = (k) => (k[1] ? (100 * k[0]) / k[1] : NaN);
  const gruppenMittel = [...jeGruppe.values()].map((l) => mittel(l));
  return {
    events: events.length, runden,
    gruppenMedian: median(gruppenMittel), gruppenMin: Math.min(...gruppenMittel), gruppenMax: Math.max(...gruppenMittel),
    gruppenUnter80: gruppenMittel.filter((v) => v < 0.8).length, gruppen: gruppenMittel.length,
    mechanik: mech.mit ? Object.fromEntries(Object.entries(mech).filter(([k]) => k !== "mit").map(([k, v]) => [k, v / runden])) : null,
    rhoRunde: mittel(jeRunde), rhoRundeMedian: median(jeRunde),
    rhoEvent: mittel(jeEvent.filter((v) => !Number.isNaN(v))), rhoEventAbs: mittel(jeEventAbs.filter((v) => !Number.isNaN(v))),
    validitaetRunde: mittel(validitaet),
    rhoSaison: rho([...saison.values()].map((s) => ({ eig: s.eig / s.k, wert: s.wert / s.k }))),
    star1: (100 * star1) / runden, star2: (100 * star2) / runden, starLetzt: (100 * starLetzt) / runden,
    paarGross: q(paar.gross), paarMittel: q(paar.mittel), paarKlein: q(paar.klein),
    paarAnteil: { gross: paar.gross[1], mittel: paar.mittel[1], klein: paar.klein[1] },
    teamRho: mittel(teamRho.filter((v) => !Number.isNaN(v))),
    ausfall: (100 * raus) / kaempfer, takte: takte / runden,
  };
}

const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
const ausgabe = { spiele: SPIELE, seite: SEITE, stroeme: {}, pp: {} };
const fehler = [];
try {
  const seite = await browser.newPage();
  seite.on("pageerror", (e) => fehler.push(String(e)));
  await seite.goto(SEITE, { waitUntil: "networkidle" });
  await seite.waitForFunction(() => window.__arena && window.__arena.miniDmFfaEvent, null, { timeout: 60000 });
  const hatSonde = await seite.evaluate(() => typeof window.__arena.miniDmFfaSonde === "function");
  const gewichte = await seite.evaluate(() => window.__arena.matrix("mini-dm"));
  const kader = eignungNeu(roheKader, gewichte);
  ausgabe.gewichte = gewichte;
  if (PARAM) {
    if (!hatSonde) throw new Error("--param braucht window.__arena.miniDmFfaParameter (neuer Motorstand).");
    ausgabe.parameter = await seite.evaluate((p) => window.__arena.miniDmFfaParameter(p), PARAM);
  } else if (hatSonde) {
    ausgabe.parameter = await seite.evaluate(() => window.__arena.miniDmFfaParameter());
  }
  if (!NUR_PP) {
    for (const versatz of STROEME) {
      const t0 = Date.now();
      let events;
      if (hatSonde) {
        events = (await seite.evaluate(({ kader, gruppen, n, versatz }) =>
          window.__arena.miniDmFfaSonde(kader, { gruppen, n, versatz, mitStatistik: true }), { kader, gruppen: GRUPPEN, n: SPIELE, versatz })).events;
      } else {
        // ALTER MOTORSTAND (vorher-Messung, z. B. origin/main): dieselbe Event-Schleife von aussen,
        // ohne Formkarten-Ziehung fuer die zwei Fremdkader (der alte Motor kennt die Sonde nicht).
        events = await seite.evaluate(({ kader, gruppen, n, versatz }) => {
          const out = [];
          gruppen.forEach((gr, g) => {
            const teams = gr.map((ix) => kader[ix]);
            for (let i = 0; i < n; i++) {
              const ev = window.__arena.miniDmFfaEvent(teams, (7001 + versatz + g * 7919 + i * 104729) >>> 0);
              out.push({ gruppe: g, lauf: i, teamsIx: gr,
                runden: ev.runden.map((r) => ({ slotId: r.slotId, takte: r.dauer,
                  teilnehmer: r.teams.map((t) => ({ n: t.n, side: t.side, eig: t.eig, wert: t.beitrag, platz: t.rundenPlatz, raus: t.down })) })),
                teams: ev.teams.map((t) => ({ side: t.side, eventPlatz: t.eventPlatz })) });
            }
          });
          return out;
        }, { kader, gruppen: GRUPPEN, n: SPIELE, versatz });
      }
      ausgabe.stroeme[versatz] = { ...auswertenFfa(events), sekunden: (Date.now() - t0) / 1000 };
    }
  }
  if (MIT_PP) {
    if (!hatSonde) throw new Error("--pp braucht window.__arena.miniDmFfaEinfluss (neuer Motorstand).");
    for (const versatz of STROEME) {
      const t0 = Date.now();
      const r = await seite.evaluate(({ kader, gruppen, n, versatz }) =>
        window.__arena.miniDmFfaEinfluss(kader, { gruppen, n, versatz }), { kader, gruppen: GRUPPEN, n: PP_LAEUFE, versatz });
      ausgabe.pp[versatz] = { ...r, sekunden: (Date.now() - t0) / 1000 };
    }
  }
} finally {
  await browser.close();
}

const f = (x, k = 3) => (x == null || Number.isNaN(x) ? "—" : x.toFixed(k));
console.log(`Mini-DM 4-Team-FFA — kaderfest, ${TEAMNAMEN.length} Teams, ${GRUPPEN.length} Vierergruppen, ${SPIELE} Events je Gruppe und Strom`);
console.log(`Gewichte (Motor): ${JSON.stringify(ausgabe.gewichte)}`);
for (const [v, s] of Object.entries(ausgabe.stroeme)) {
  console.log(`\nStrom ${v} (${s.events} Events, ${s.runden} Runden, ${s.sekunden.toFixed(1)} s)`);
  console.log(`  rho je Runde (4 Kaempfer)     Mittel ${f(s.rhoRunde)}  Median ${f(s.rhoRundeMedian)}`);
  console.log(`  je Vierergruppe (Mittel der Runden): Median ${f(s.gruppenMedian)}  Spannweite ${f(s.gruppenMin)}..${f(s.gruppenMax)}  unter 0,80: ${s.gruppenUnter80} von ${s.gruppen}`);
  console.log(`  rho je Event (16, Anteil)     ${f(s.rhoEvent)}    (16, absolute Wertung) ${f(s.rhoEventAbs)}`);
  console.log(`  Validitaet je Runde           ${f(s.validitaetRunde)}    rho Saison (110 Spieler) ${f(s.rhoSaison)}`);
  console.log(`  Star: Rang 1 ${f(s.star1, 1)} %  · erste zwei ${f(s.star2, 1)} %  · letzter ${f(s.starLetzt, 1)} %`);
  console.log(`  Paare richtig: >=15 ${f(s.paarGross, 1)} %  · 5-15 ${f(s.paarMittel, 1)} %  · <5 ${f(s.paarKlein, 1)} %   (Paare ${JSON.stringify(s.paarAnteil)})`);
  console.log(`  Team-rho (Eventplatz)         ${f(s.teamRho)}    Ausfallquote ${f(s.ausfall, 1)} %   Takte je Runde ${f(s.takte, 2)}`);
  if (s.mechanik) console.log(`  je Runde: Buendnisse ${f(s.mechanik.buendnisse, 2)} · Schwachstellen ${f(s.mechanik.schwachstellen, 2)} · Positionierungen ${f(s.mechanik.ausgewichen, 2)} · Finishes ${f(s.mechanik.finishes, 2)} · Finisher ueberstanden ${f(s.mechanik.ueberstanden, 2)} · K.o. durch Schaden ${f(s.mechanik.kos, 2)} · geteilte Beute ${f(s.mechanik.beute, 2)}`);
}
for (const [v, r] of Object.entries(ausgabe.pp)) {
  console.log(`\nPp Strom ${v}: ${r.abweichungPp} Pp (${r.proben} Kaempfer-Proben, ${r.sekunden.toFixed(1)} s)`);
  for (const z of r.reihen) console.log(`  ${z.attribut.padEnd(13)} ${String(z.anteil).padStart(5)} %  (Gewicht ${ausgabe.gewichte[z.attribut] || 0})  Rohgewinn ${z.gewinn}`);
}
console.log("\nSeitenfehler: " + (fehler.length ? fehler.slice(0, 3).join(" | ") : "keine"));
if (JSON_AUS) writeFileSync(JSON_AUS, JSON.stringify(ausgabe, null, 1));
