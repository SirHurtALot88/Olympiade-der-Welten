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
//        [--aufstellung=optimal|verschoben] [--json=<datei>] [--k=2..6]
//
// Ohne Schalter: Rangtreue, zwei Saatstroeme (Versatz 0 und 10 000 000), 6 Events je Gruppe.
// --pp misst zusaetzlich die Pp-Abweichung (Budget-Methode, +15) in beiden Stroemen.
// --param setzt Schlagwechsel-Parameter nur fuer diese Messung (window.__arena.miniDmFfaParameter).
// --seite misst einen anderen Motorstand (z. B. eine Kopie von origin/main fuer „vorher").
// --aufstellung (20.10., PR A der Mini-DM-Anbindung): testet rho/Pp mit einer SYNTHETISCHEN
//   Manager-Aufstellung statt der reinen Eignungs-Auswahl -- s. Kommentar bei AUFSTELLUNG unten
//   und `mdffaPlatzFuerModus()` in battle-mode.engine.js.
//
// --k=2..6 (PR 3 des 6-PR-Opus-Plans, 21.10., ABNAHME DER SECHS-ROLLEN-ERWEITERUNG AUS PR 2):
//   misst zusaetzlich -- oder STATT der alten 4er-Messung, falls --k die einzige Kadergroesse
//   ist, die noch interessiert -- JEDE angegebene Kadergroesse k einzeln, mit den k-spezifischen
//   Rollen aus MINI_DM_FFA_SLOTS_JE_K[k] (window.__arena.miniDmFfaSonde/-Einfluss({k,...}), s. dort).
//   Syntax: eine einzelne Zahl ("--k=4"), eine kommagetrennte Liste ("--k=2,4,6") oder ein
//   Bereich ("--k=2..6", identisch zu "2,3,4,5,6"). OHNE --k bleibt das Skript BYTE-IDENTISCH zu
//   vorher (ein einziger Durchlauf ohne `k`-Option, exakt der alte Vierer-Pfad aus PR 0 (13.10.) --
//   `mdffaRollenFuerK(null)` in der Engine). MIT --k ersetzt die Kadergroessen-Messung die alte
//   `ausgabe.stroeme`/`ausgabe.pp` NICHT, sondern ergaenzt sie um `ausgabe.kWerte[k]` mit derselben
//   Form je k (Rangtreue optional per --ohne-rangtreue/--nur-pp wie gewohnt) -- additiv, weil ein
//   kuenftiger Aufrufer (PR 5) beide Zahlen (den alten 4er-Vergleichswert UND die neue k-Tabelle)
//   parallel braucht, bis die Produktion vollstaendig auf variable k umgestellt ist.
//   Braucht den neuen Motorstand (`hatSonde`, PR 2 hat `opt.k` erst eingefuehrt) -- gegen einen
//   AELTEREN `--seite=`-Stand (ohne `opt.k`) wirft --k einen Fehler statt stillschweigend die
//   alte Vierer-Logik zu messen.
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
// AUFSTELLUNG (20.10., PR A der Mini-DM-Anbindung): ohne Schalter unveraendert die reine
// Eignungs-Auswahl (Vorher-Vergleichswert). "optimal" setzt je Team explizit Eignungs-Rang 0..3
// auf die vier Rollen (muss rho/Pp BIT-IDENTISCH zum Default liefern -- Sanity-Check der
// Aufstellungs-Verdrahtung selbst). "verschoben" setzt Rang 1..4 (der Manager haelt seinen
// Top-Mini-DM-Talent fuer eine andere Disziplin zurueck) -- die realistische Abweichung, die der
// Auftrag befuerchtet, s. battle-mode.engine.js `mdffaPlatzFuerModus()`-Kommentar.
const AUFSTELLUNG = wert("aufstellung");
if (AUFSTELLUNG && AUFSTELLUNG !== "optimal" && AUFSTELLUNG !== "verschoben") {
  throw new Error(`--aufstellung muss "optimal" oder "verschoben" sein, bekam "${AUFSTELLUNG}".`);
}
// --k=2..6 (s. Kopfkommentar): "2..6" -> [2,3,4,5,6], "2,4,6" -> [2,4,6], "4" -> [4]. Leer (kein
// --k), wenn der Schalter fehlt -- dann bleibt die Messung unten exakt der alte Vierer-Pfad.
function parseKListe(roh) {
  if (!roh) return [];
  const bereich = roh.match(/^(\d+)\.\.(\d+)$/);
  if (bereich) {
    const [von, bis] = [Number(bereich[1]), Number(bereich[2])];
    if (von > bis) throw new Error(`--k=${roh}: Bereich rueckwaerts.`);
    return Array.from({ length: bis - von + 1 }, (_, i) => von + i);
  }
  return roh.split(",").map((s) => Number(s.trim()));
}
const K_LISTE = parseKListe(wert("k"));
for (const k of K_LISTE) {
  if (!Number.isInteger(k) || k < 2 || k > 6) throw new Error(`--k: unbekannte Mini-DM-Kadergroesse ${k} -- erwartet 2..6.`);
}
// --nur-k: ueberspringt den alten Vierer-Pfad (spart Laufzeit, wenn ohnehin nur die k-Tabelle
// interessiert) -- ohne --k ist dieser Schalter wirkungslos (es gibt dann nichts zu ueberspringen).
const NUR_K = hat("nur-k");
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
// `kWerte` wird NUR gesetzt, wenn --k tatsaechlich etwas misst -- ohne --k bleibt `ausgabe` sonst
// GENAU die alte Form (Opus-Review PR3, 24.10.: "ohne --k byte-identisch" stimmte fuer die
// Konsolenausgabe/JSON-Struktur nicht ganz, weil dieser Schluessel immer da war).
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
  if (K_LISTE.length && !hatSonde) throw new Error("--k braucht window.__arena.miniDmFfaSonde/-Einfluss mit opt.k (neuer Motorstand, PR 2).");

  // EINE Kadergroesse (k=null -> alter Vierer-Pfad, k=2..6 -> MINI_DM_FFA_SLOTS_JE_K[k]) messen --
  // dieselbe Logik, die vor --k inline im Skript stand, jetzt wiederverwendbar fuer jedes k.
  async function missEineKadergroesse(k) {
    const resultat = { stroeme: {}, pp: {} };
    if (!NUR_PP) {
      for (const versatz of STROEME) {
        const t0 = Date.now();
        let events;
        if (hatSonde) {
          events = (await seite.evaluate(({ kader, gruppen, n, versatz, platzModus, k }) =>
            window.__arena.miniDmFfaSonde(kader, { gruppen, n, versatz, mitStatistik: true, platzModus, k: k ?? undefined }),
            { kader, gruppen: GRUPPEN, n: SPIELE, versatz, platzModus: AUFSTELLUNG, k })).events;
        } else {
          // ALTER MOTORSTAND (vorher-Messung, z. B. origin/main): dieselbe Event-Schleife von aussen,
          // ohne Formkarten-Ziehung fuer die zwei Fremdkader (der alte Motor kennt die Sonde nicht).
          // k ist hier immer null (s. Pruefung oben: --k braucht hatSonde).
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
        resultat.stroeme[versatz] = { ...auswertenFfa(events), sekunden: (Date.now() - t0) / 1000 };
      }
    }
    if (MIT_PP) {
      if (!hatSonde) throw new Error("--pp braucht window.__arena.miniDmFfaEinfluss (neuer Motorstand).");
      for (const versatz of STROEME) {
        const t0 = Date.now();
        const r = await seite.evaluate(({ kader, gruppen, n, versatz, platzModus, k }) =>
          window.__arena.miniDmFfaEinfluss(kader, { gruppen, n, versatz, platzModus, k: k ?? undefined }),
          { kader, gruppen: GRUPPEN, n: PP_LAEUFE, versatz, platzModus: AUFSTELLUNG, k });
        resultat.pp[versatz] = { ...r, sekunden: (Date.now() - t0) / 1000 };
      }
    }
    return resultat;
  }

  // ALTER VIERER-PFAD, UNVERAENDERT -- egal ob --k zusaetzlich gesetzt ist (additiv, s.
  // Kopfkommentar): `ausgabe.stroeme`/`ausgabe.pp` bleiben die Top-Level-Felder von vorher.
  // --nur-k ueberspringt ihn (Laufzeit), wenn ohnehin nur die k-Tabelle gebraucht wird.
  if (!NUR_K) {
    const alt = await missEineKadergroesse(null);
    ausgabe.stroeme = alt.stroeme;
    ausgabe.pp = alt.pp;
  }

  // NEU: JEDE angegebene Kadergroesse zusaetzlich, unter `ausgabe.kWerte[k]` -- dieser
  // Schluessel entsteht nur, wenn --k ueberhaupt etwas zu messen hat (s. Kommentar an `ausgabe`
  // oben).
  if (K_LISTE.length) {
    ausgabe.kWerte = {};
    for (const k of K_LISTE) {
      ausgabe.kWerte[k] = await missEineKadergroesse(k);
    }
  }
} finally {
  await browser.close();
}

const f = (x, k = 3) => (x == null || Number.isNaN(x) ? "—" : x.toFixed(k));
// NEUE, k-generische Druckfunktion -- NUR benutzt, wenn --k tatsaechlich etwas misst (s. unten).
// Byte-identisch zu vorher heisst: OHNE --k laeuft weiterhin der Original-Block darunter,
// Wort fuer Wort wie vor PR 3 (Opus-Review, 24.10.).
function druckeKadergroesse(titel, stroeme, pp) {
  for (const [v, s] of Object.entries(stroeme)) {
    console.log(`\n${titel} — Strom ${v} (${s.events} Events, ${s.runden} Runden, ${s.sekunden.toFixed(1)} s)`);
    console.log(`  rho je Runde (Kaempfer)       Mittel ${f(s.rhoRunde)}  Median ${f(s.rhoRundeMedian)}`);
    console.log(`  je Vierergruppe (Mittel der Runden): Median ${f(s.gruppenMedian)}  Spannweite ${f(s.gruppenMin)}..${f(s.gruppenMax)}  unter 0,80: ${s.gruppenUnter80} von ${s.gruppen}`);
    console.log(`  rho je Event (Anteil, SPIELER-Ebene)  ${f(s.rhoEvent)}    (absolute Wertung) ${f(s.rhoEventAbs)}`);
    console.log(`  Validitaet je Runde           ${f(s.validitaetRunde)}    rho Saison (110 Spieler) ${f(s.rhoSaison)}`);
    console.log(`  Star: Rang 1 ${f(s.star1, 1)} %  · erste zwei ${f(s.star2, 1)} %  · letzter ${f(s.starLetzt, 1)} %`);
    console.log(`  Paare richtig: >=15 ${f(s.paarGross, 1)} %  · 5-15 ${f(s.paarMittel, 1)} %  · <5 ${f(s.paarKlein, 1)} %   (Paare ${JSON.stringify(s.paarAnteil)})`);
    console.log(`  Team-rho (Eventplatz, NICHT die CLAUDE.md-Schranke) ${f(s.teamRho)}    Ausfallquote ${f(s.ausfall, 1)} %   Takte je Runde ${f(s.takte, 2)}`);
    if (s.mechanik) console.log(`  je Runde: Buendnisse ${f(s.mechanik.buendnisse, 2)} · Schwachstellen ${f(s.mechanik.schwachstellen, 2)} · Positionierungen ${f(s.mechanik.ausgewichen, 2)} · Finishes ${f(s.mechanik.finishes, 2)} · Finisher ueberstanden ${f(s.mechanik.ueberstanden, 2)} · K.o. durch Schaden ${f(s.mechanik.kos, 2)} · geteilte Beute ${f(s.mechanik.beute, 2)}`);
  }
  for (const [v, r] of Object.entries(pp)) {
    console.log(`\n${titel} — Pp Strom ${v}: ${r.abweichungPp} Pp (${r.proben} Kaempfer-Proben, ${r.sekunden.toFixed(1)} s)`);
    for (const z of r.reihen) console.log(`  ${z.attribut.padEnd(13)} ${String(z.anteil).padStart(5)} %  (Gewicht ${ausgabe.gewichte[z.attribut] || 0})  Rohgewinn ${z.gewinn}`);
  }
}
if (K_LISTE.length) {
  // MIT --k: neue, k-generische Ausgabe (keine Vorgaenger-Form zu erhalten -- dieser Aufruf-Stil
  // ist neu). `rho je Event (Anteil)` ist hier die CLAUDE.md-massgebliche Spieler-Ebene-Zahl
  // (Pflichtgroesse "rho je Spiel" bei n=4*k Teilnehmern je Event) -- NICHT `teamRho`.
  console.log(`Mini-DM FFA — kaderfest, ${TEAMNAMEN.length} Teams, ${GRUPPEN.length} Vierergruppen, ${SPIELE} Events je Gruppe und Strom, Aufstellung: ${AUFSTELLUNG || "aus (reine Eignungs-Auswahl)"}`);
  console.log(`Gewichte (Motor): ${JSON.stringify(ausgabe.gewichte)}`);
  if (!NUR_K) druckeKadergroesse("Alter Vierer-Pfad (k=4, MINI_DM_FFA_ROLLEN)", ausgabe.stroeme, ausgabe.pp);
  for (const k of K_LISTE) druckeKadergroesse(`k=${k} (MINI_DM_FFA_SLOTS_JE_K[${k}])`, ausgabe.kWerte[k].stroeme, ausgabe.kWerte[k].pp);
} else {
  // OHNE --k: der Original-Block aus PR 0 (13.10.), unveraendert -- s. Kopfkommentar an `ausgabe`.
  console.log(`Mini-DM 4-Team-FFA — kaderfest, ${TEAMNAMEN.length} Teams, ${GRUPPEN.length} Vierergruppen, ${SPIELE} Events je Gruppe und Strom, Aufstellung: ${AUFSTELLUNG || "aus (reine Eignungs-Auswahl)"}`);
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
}
console.log("\nSeitenfehler: " + (fehler.length ? fehler.slice(0, 3).join(" | ") : "keine"));
if (JSON_AUS) writeFileSync(JSON_AUS, JSON.stringify(ausgabe, null, 1));
