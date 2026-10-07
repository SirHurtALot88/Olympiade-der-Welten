// VERIFIKATION ARENA-PERSOENLICHKEIT P1 (07.10., docs/design/arena-zielwahl-opus-empfehlung-02-10.md
// Abschnitt 4, 7 und 10): in Mini-DM ist der Zusammenhalt Handwerk (V5, "ausgewogen" fuer
// alle) — geschaltet ueber `ARENA_ART[d].persHandwerk`, Zielneigung, Haltung und Bindung
// bleiben Persoenlichkeit. Battlefield steht nach Abbruchregel 1 auf `[]` (V9 bestand A-E,
// verfehlte aber Pp-Kriterium F deutlich), TDM vorerst ebenfalls (V9 bestand A-E, F ist
// ungemessen) — beide damit bit-identisch zum Stand vor P1. Die V9-Messungen beider sind mit
// `--variante=tdm:z+b` bzw. `--variante=battlefield:z+b` wiederholbar (s. unten).
//
// Faehrt je Disziplin und Saatstrom ZWEI kaderfeste Laeufe auf DERSELBEN Seite: einmal mit dem
// Schalter aus (`window.__arena.persHandwerk({tdm:[],"mini-dm":[],battlefield:[]})`, die
// Nullprobe) und einmal mit dem eingebauten Stand. Gemessen ueber dieselbe Schnittstelle und
// dieselbe Kader-Familie wie miss-alle-disziplinen.mjs / miss-star-paartreue.mjs
// (`disziplinProbe`, data/generated/kaderfamilie-live-save.json, n=24 je Paarung).
// Strom 1: saat0 1337 (die offizielle Abnahme). Strom 2: saat0 900001, mutatorSaat 10000000
// (dieselbe Konvention wie messe-arena-einfluss-zweiter-saatstamm.mjs und das Dokument, 2.2).
//
// Prueft (Abbruchkriterien A-E aus Abschnitt 7, F und G laufen ueber eigene Werkzeuge, s. PR):
//   (0) Schalter steht wie gebaut: tdm [], mini-dm [z], battlefield []
//   (N) Nullprobe: die Spiele mit Schalter aus sind BIT-IDENTISCH zum Stand vor P1
//       (SHA-256 ueber alle zurueckgegebenen Teilnehmerlisten, Referenz unten, gezogen auf
//       origin/main 2470c502 mit derselben Messung). Fuer eine Disziplin mit leerem Handwerk
//       (Battlefield) muss zusaetzlich der eingebaute Stand denselben Fingerabdruck liefern.
//   (A) Median rho je Spiel >= Ist + 0,05 in BEIDEN Stroemen
//   (B) Median rho Saison steigt in beiden Stroemen
//   (C) paarweise besser (rho je Spiel) in >= 6 von 10 Paarung-Strom-Faellen
//   (D) Star auf Rang 1, Star in den Top 2, Paare >= 15 Punkte richtig: je Strom keiner mehr
//       als 3 Prozentpunkte unter Ist
//   (E) Team-Ergebnistreue im Mittel beider Stroeme nicht mehr als 5 Prozentpunkte unter Ist
//   (S) keine `pageerror`
// Daneben, rein berichtend: Spannweite, eps² der Persoenlichkeit, Spiel-zu-Spiel-Verlaesslichkeit.
//
//   node scripts/verify-arena-persoenlichkeit-p1-paket-07-10.mjs
//   node scripts/verify-arena-persoenlichkeit-p1-paket-07-10.mjs --disziplinen=mini-dm,battlefield
//   node scripts/verify-arena-persoenlichkeit-p1-paket-07-10.mjs --stroeme=1 --n=24
//   node scripts/verify-arena-persoenlichkeit-p1-paket-07-10.mjs --seite=/pfad/battle-mode.html --nur-ist
//        (misst eine andere Fassung, z.B. einen origin/main-Abzug, nur im Ist-Zustand und gibt
//         die Fingerabdruecke aus — so ist die Nullprobe-Referenz unten entstanden)
//   node scripts/verify-arena-persoenlichkeit-p1-paket-07-10.mjs --disziplinen=battlefield --variante=battlefield:z+b
//        (DIAGNOSE: misst statt des eingebauten Stands eine andere Handwerk-Belegung und prueft
//         A-E dagegen — so ist der Battlefield-V9-Befund im Dokument Abschnitt 10 entstanden;
//         der Schalterstand (0) wird dabei nicht geprueft)
//
// Laufzeit (n=24, ohne Last): TDM ~11 min je Lauf, Mini-DM/Battlefield ~3 min je Lauf — alle
// drei, beide Stroeme, beide Schalterstellungen also rund 70 min.
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { auswerten, rho, median, spannweite, ladeKaderFamilieAusDatei } from "./lib/rangtreue-messung.mjs";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const args = process.argv.slice(2);
const wert = (name, vorgabe) => args.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=") ?? vorgabe;
const N = Number(wert("n", 24));
const DISZIPLINEN = wert("disziplinen", "tdm,mini-dm,battlefield").split(",").filter(Boolean);
const STROEME = wert("stroeme", "1,2").split(",").filter(Boolean).map(Number);
const SEITE_PFAD = path.resolve(wert("seite", path.join(WURZEL, "public/mockups/battle-mode.html")));
const NUR_IST = args.includes("--nur-ist");
const ROH = wert("roh", null);
const KADERFAMILIE_PFAD = process.env.OLY_KADER_FAMILIE || path.join(WURZEL, "data/generated/kaderfamilie-live-save.json");

const STROM = { 1: { saat0: 1337, mutatorSaat: 0 }, 2: { saat0: 900001, mutatorSaat: 10_000_000 } };
const GEBAUT = { tdm: [], "mini-dm": ["z"], battlefield: [] };
const AUS = { tdm: [], "mini-dm": [], battlefield: [] };
// --variante=battlefield:z+b,tdm:z  (Diagnose, s. Kopf): ueberschreibt die "an"-Belegung je Disziplin.
const VARIANTE = Object.fromEntries((wert("variante", "") || "").split(",").filter(Boolean)
  .map((t) => { const [d, k] = t.split(":"); return [d, (k || "").split("+").filter(Boolean)]; }));
// Eingaben pruefen, bevor ein Browser startet: ein Tippfehler darf nicht still den eingebauten
// Stand als "Variante" messen, ein unbekannter Strom nicht erst im Browser abstuerzen.
for (const [d, k] of Object.entries(VARIANTE)) {
  if (!(d in AUS)) { console.error(`--variante: unbekannte Arena-Disziplin "${d}" (erlaubt: ${Object.keys(AUS).join(", ")})`); process.exit(2); }
  if (k.some((x) => x !== "z" && x !== "b")) { console.error(`--variante: nur "z" und "b" erlaubt, bekam ${k.join("+")}`); process.exit(2); }
}
for (const s of STROEME) if (!STROM[s]) { console.error(`--stroeme: unbekannter Strom ${s} (erlaubt: 1, 2)`); process.exit(2); }
// Die Nullprobe-Referenz gilt nur fuer die eingecheckte Kader-Familie auf der eigenen Seite.
const REFERENZ_GILT = N === 24 && !process.env.OLY_KADER_FAMILIE && !args.some((a) => a.startsWith("--seite="));

// NULLPROBE-REFERENZ: SHA-256 (erste 16 Hex-Zeichen) ueber JSON.stringify der `varianten`
// (label + spiele) aus disziplinProbe(d,{n:24,kaderFamilie,zielDiag:true,saat0,mutatorSaat}),
// gezogen auf origin/main 2470c502 (vor P1) mit `--nur-ist`. Gilt nur fuer n=24 und die
// eingecheckte Kader-Familie — bei anderem n wird (N) uebersprungen statt falsch gemeldet.
const NULLPROBE_REFERENZ = {
  "tdm|1": "f1dee6dcabf87f9e",
  "tdm|2": "8c535b457fc658f5",
  "mini-dm|1": "b1e1bd3f534e8fc7",
  "mini-dm|2": "c3dc4234c1ed02ae",
  "battlefield|1": "bb0f1f6df87d4029",
  "battlefield|2": "d23e76fc7aef9a08",
};

const rund = (x, k = 3) => (x == null || Number.isNaN(x) ? null : Math.round(x * 10 ** k) / 10 ** k);
const pct = (x) => (x == null ? "—" : (x * 100).toFixed(1) + " %");
const f3 = (x) => (x == null || Number.isNaN(x) ? "—" : x.toFixed(3));

// ---------------------------------------------------------------------------------------
// Kennzahlen einer Messung (eine `varianten`-Liste aus disziplinProbe).
function raenge(werte) {
  const idx = werte.map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v);
  const out = new Array(werte.length);
  let k = 0;
  while (k < idx.length) {
    let j = k;
    while (j + 1 < idx.length && idx[j + 1].v === idx[k].v) j++;
    for (let m = k; m <= j; m++) out[idx[m].i] = (k + j) / 2 + 1;
    k = j + 1;
  }
  return out;
}
function olsResiduen(xs, ys) {
  const n = xs.length;
  const mx = xs.reduce((s, v) => s + v, 0) / n, my = ys.reduce((s, v) => s + v, 0) / n;
  let sxy = 0, sxx = 0;
  for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; }
  const b = sxx > 1e-9 ? sxy / sxx : 0, a = my - b * mx;
  return xs.map((x, i) => ys[i] - (a + b * x));
}
// eps² der Persoenlichkeit gegen das Eignungs-Residuum des Rangs (Methode wie
// miss-arena-rangvarianz-aufschluesselung.mjs, unverzerrt korrigiert wie im Dokument 1.1).
function epsPersoenlichkeit(varianten) {
  const zeilen = [];
  for (const v of varianten) {
    const agg = new Map();
    for (const s of v.spiele) for (const t of s.teilnehmer) {
      const a = agg.get(t.n) || { eig: 0, wert: 0, k: 0, pers: t.persTyp ?? null };
      a.eig += t.eig; a.wert += t.wert; a.k++; agg.set(t.n, a);
    }
    const sp = [...agg.values()].map((a) => ({ eig: a.eig / a.k, wert: a.wert / a.k, pers: a.pers }));
    if (sp.length < 4) continue;
    const n = sp.length;
    const prE = raenge(sp.map((s) => s.eig)).map((r) => (r - 1) / (n - 1));
    const prW = raenge(sp.map((s) => s.wert)).map((r) => (r - 1) / (n - 1));
    olsResiduen(prE, prW).forEach((r, i) => zeilen.push({ pers: sp[i].pers, r }));
  }
  const g = new Map();
  for (const z of zeilen) { if (z.pers == null) continue; if (!g.has(z.pers)) g.set(z.pers, []); g.get(z.pers).push(z.r); }
  const alle = [...g.values()].flat();
  const n = alle.length, k = g.size;
  if (n < 4 || k < 2) return null;
  const m = alle.reduce((s, v) => s + v, 0) / n;
  let ssG = 0, ssZ = 0;
  for (const v of alle) ssG += (v - m) ** 2;
  for (const vals of g.values()) { const mm = vals.reduce((s, v) => s + v, 0) / vals.length; ssZ += vals.length * (mm - m) ** 2; }
  const eta2 = ssG > 0 ? ssZ / ssG : 0;
  return { eta2, eps2: 1 - (1 - eta2) * (n - 1) / (n - k), n, k };
}
// Spiel-zu-Spiel-Verlaesslichkeit: mittleres Spearman der Wert-Vektoren je zwei Spiele einer
// Paarung, Median ueber die Paarungen (Dokument 2.2, Fussnote 2).
function verlaesslichkeit(varianten) {
  const jeP = [];
  for (const v of varianten) {
    const namen = v.spiele[0].teilnehmer.map((t) => t.n);
    const vek = v.spiele.map((s) => { const m = new Map(s.teilnehmer.map((t) => [t.n, t.wert])); return namen.map((nm) => m.get(nm) ?? 0); });
    let sum = 0, k = 0;
    for (let i = 0; i < vek.length; i++) for (let j = i + 1; j < vek.length; j++) {
      const r = rho(vek[i].map((a, x) => ({ eig: a, wert: vek[j][x] })));
      if (!Number.isNaN(r)) { sum += r; k++; }
    }
    if (k) jeP.push(sum / k);
  }
  return jeP.length ? median(jeP) : null;
}
function kennzahlen(varianten) {
  const jeP = varianten.map((v) => ({ label: v.label, ...auswerten(v.spiele) }));
  let spiele = 0, r1 = 0, t2 = 0, paareG = 0, paareR = 0, teamG = 0, teamR = 0;
  for (const v of varianten) for (const s of v.spiele) {
    const tn = s.teilnehmer;
    if (tn.length < 2) continue;
    spiele++;
    const star = tn.reduce((a, b) => (b.eig > a.eig ? b : a));
    const rang = 1 + tn.filter((t) => t.wert > star.wert).length;
    if (rang === 1) r1++;
    if (rang <= 2) t2++;
    for (let i = 0; i < tn.length; i++) for (let j = i + 1; j < tn.length; j++) {
      const d = tn[i].eig - tn[j].eig;
      if (Math.abs(d) < 15) continue;
      paareG++;
      const hoch = d > 0 ? tn[i] : tn[j], tief = d > 0 ? tn[j] : tn[i];
      if (hoch.wert >= tief.wert) paareR++;
    }
    // Team-Ergebnistreue (Dokument 2.2, Fussnote 1): Seitenmittel der Eignung >= 5 Punkte
    // auseinander -> holt die eignungsstaerkere Seite mehr als die Haelfte des Gesamtbeitrags?
    const seiten = [0, 1].map((sd) => tn.filter((t) => t.seite === sd));
    if (seiten[0].length && seiten[1].length) {
      const mE = seiten.map((l) => l.reduce((a, t) => a + t.eig, 0) / l.length);
      if (Math.abs(mE[0] - mE[1]) >= 5) {
        const sumW = seiten.map((l) => l.reduce((a, t) => a + t.wert, 0));
        const st = mE[0] > mE[1] ? 0 : 1;
        teamG++;
        if (sumW[st] > (sumW[0] + sumW[1]) / 2) teamR++;
      }
    }
  }
  return {
    jeP,
    spielMed: median(jeP.map((v) => v.spiel)), spielSpan: spannweite(jeP.map((v) => v.spiel)),
    saisonMed: median(jeP.map((v) => v.saison)), saisonSpan: spannweite(jeP.map((v) => v.saison)),
    starRang1: r1 / spiele, starTop2: t2 / spiele, paartreue: paareG ? paareR / paareG : null, paareG,
    teamTreue: teamG ? teamR / teamG : null, teamG,
    eps: epsPersoenlichkeit(varianten), verl: verlaesslichkeit(varianten),
  };
}
const fingerabdruck = (varianten) =>
  createHash("sha256").update(JSON.stringify(varianten.map((v) => ({ label: v.label, spiele: v.spiele })))).digest("hex").slice(0, 16);

// ---------------------------------------------------------------------------------------
const geladen = ladeKaderFamilieAusDatei(KADERFAMILIE_PFAD);
if (!geladen) { console.error("Kader-Familie fehlt: " + KADERFAMILIE_PFAD); process.exit(2); }
const kaderFamilie = geladen.familie;

let alleOk = true;
const pruefe = (ok, text) => { console.log(`  ${ok ? "OK    " : "FEHLER"} ${text}`); if (!ok) alleOk = false; };
const fehler = [];
const roh = {};
const erg = {};
let stand = null, anBelegung = null;
const browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
try {
  const seite = await browser.newPage();
  seite.on("pageerror", (e) => fehler.push(String(e)));
  await seite.goto(pathToFileURL(SEITE_PFAD).href, { waitUntil: "domcontentloaded" });
  await seite.waitForFunction(() => window.__arena && window.__arena.disziplinProbe, null, { timeout: 30000 });
  const hatSchalter = await seite.evaluate(() => typeof window.__arena.persHandwerk === "function");
  console.log(`Gemessene Seite: ${SEITE_PFAD}`);
  console.log(`Kader-Quelle: ${geladen.quelle} (${kaderFamilie.length} Paarungen), n=${N} je Paarung, Stroeme ${STROEME.join("/")}\n`);

  if (!NUR_IST) {
    if (!hatSchalter) throw new Error("window.__arena.persHandwerk fehlt — Seite ohne P1? Mit --nur-ist messen.");
    stand = await seite.evaluate(() => window.__arena.persHandwerk());
    anBelegung = { ...stand, ...VARIANTE };
    if (Object.keys(VARIANTE).length) {
      console.log(`DIAGNOSE-VARIANTE statt des eingebauten Stands: ${JSON.stringify(VARIANTE)} — (0) wird nicht geprueft.\n`);
    } else {
      console.log("(0) Schalterstand wie gebaut (Dokument 4.1 und 10):");
      for (const d of Object.keys(GEBAUT))
        pruefe(JSON.stringify(stand[d]) === JSON.stringify(GEBAUT[d]), `${d}: persHandwerk ${JSON.stringify(stand[d])} (erwartet ${JSON.stringify(GEBAUT[d])})`);
      console.log("");
    }
  }

  const probe = (d, strom) => seite.evaluate(
    ([d, n, familie, s]) => window.__arena.disziplinProbe(d, { n, kaderFamilie: familie, zielDiag: true, saat0: s.saat0, mutatorSaat: s.mutatorSaat }),
    [d, N, kaderFamilie, STROM[strom]],
  );
  for (const d of DISZIPLINEN) {
    erg[d] = {};
    for (const strom of STROEME) {
      erg[d][strom] = {};
      const stellungen = NUR_IST ? [["ist", null]] : [["aus", AUS], ["an", anBelegung]];
      for (const [name, belegung] of stellungen) {
        if (belegung) await seite.evaluate((b) => window.__arena.persHandwerk(b), belegung);
        const t0 = Date.now();
        const x = await probe(d, strom);
        if (x.fehler || !x.varianten) { console.error(`${d} Strom ${strom} ${name}: ${x.fehler || "keine Kaderfamilie"}`); alleOk = false; continue; }
        erg[d][strom][name] = { ...kennzahlen(x.varianten), hash: fingerabdruck(x.varianten), sek: Math.round((Date.now() - t0) / 1000) };
        if (ROH) roh[`${d}|${strom}|${name}`] = x.varianten;
        console.log(`  gemessen: ${d} Strom ${strom} ${name} — rho Spiel ${f3(erg[d][strom][name].spielMed)}, Saison ${f3(erg[d][strom][name].saisonMed)}, Fingerabdruck ${erg[d][strom][name].hash} (${erg[d][strom][name].sek}s)`);
      }
      if (stand) await seite.evaluate((b) => window.__arena.persHandwerk(b), stand);
    }
  }
} finally {
  await browser.close();
}
if (ROH) writeFileSync(ROH, JSON.stringify(roh));

// ---------------------------------------------------------------------------------------
console.log("");
if (NUR_IST) {
  console.log("Nur Ist-Messung (--nur-ist). Fingerabdruecke fuer NULLPROBE_REFERENZ:");
  for (const d of DISZIPLINEN) for (const s of STROEME) if (erg[d][s].ist) console.log(`  "${d}|${s}": "${erg[d][s].ist.hash}",`);
  for (const d of DISZIPLINEN) for (const s of STROEME) {
    const k = erg[d][s].ist; if (!k) continue;
    console.log(`  ${d} Strom ${s}: rho Spiel ${f3(k.spielMed)} (Spannw. ${f3(k.spielSpan)}), Saison ${f3(k.saisonMed)}, Star R1 ${pct(k.starRang1)}, Top2 ${pct(k.starTop2)}, Paare>=15 ${pct(k.paartreue)}, Team ${pct(k.teamTreue)} (n=${k.teamG}), eps² ${f3(k.eps?.eps2)}, Verl. ${f3(k.verl)}`);
  }
} else {
  for (const d of DISZIPLINEN) {
    const e = erg[d];
    const handwerk = anBelegung[d] || [];
    console.log(`=== ${d} (persHandwerk ${JSON.stringify(handwerk)}) ===`);
    console.log("  Strom  Groesse                    Ist (aus)     P1 (an)");
    const zeile = (s, l, a, b) => console.log(`  ${String(s).padEnd(6)} ${l.padEnd(26)} ${String(a).padStart(9)}   ${String(b).padStart(9)}`);
    for (const s of STROEME) {
      const a = e[s].aus, b = e[s].an;
      if (!a || !b) continue;
      zeile(s, "rho je Spiel (Median)", f3(a.spielMed), f3(b.spielMed));
      zeile(s, "rho Saison (Median)", f3(a.saisonMed), f3(b.saisonMed));
      zeile(s, "Spannweite je Spiel", f3(a.spielSpan), f3(b.spielSpan));
      zeile(s, "Star auf Rang 1", pct(a.starRang1), pct(b.starRang1));
      zeile(s, "Star in den Top 2", pct(a.starTop2), pct(b.starTop2));
      zeile(s, "Paare >= 15 richtig", pct(a.paartreue), pct(b.paartreue));
      zeile(s, `Team-Ergebnistreue (n=${a.teamG})`, pct(a.teamTreue), pct(b.teamTreue));
      zeile(s, "eps² Persoenlichkeit", f3(a.eps?.eps2), f3(b.eps?.eps2));
      zeile(s, "Verlaesslichkeit", f3(a.verl), f3(b.verl));
      zeile(s, "je Paarung rho Spiel", "", "");
      a.jeP.forEach((p, i) => zeile("", "  " + p.label, f3(p.spiel), f3(b.jeP[i].spiel)));
    }
    const voll = STROEME.every((s) => e[s].aus && e[s].an);
    if (!voll) { pruefe(false, "unvollstaendige Messung"); continue; }
    // (N)
    for (const s of STROEME) {
      const ref = NULLPROBE_REFERENZ[`${d}|${s}`];
      if (!REFERENZ_GILT || !ref) console.log(`  —      (N) Strom ${s}: Referenz gilt nur fuer n=24, eingecheckte Kader-Familie, eigene Seite — uebersprungen (Fingerabdruck ${e[s].aus.hash})`);
      else pruefe(e[s].aus.hash === ref, `(N) Nullprobe Strom ${s} bit-identisch zum Stand vor P1 (${e[s].aus.hash} / Referenz ${ref})`);
    }
    // Leeres Handwerk (Battlefield nach Abbruchregel 1): der eingebaute Stand IST die Nullprobe.
    if (!handwerk.length) {
      for (const s of STROEME)
        pruefe(e[s].an.hash === e[s].aus.hash, `(N) Strom ${s}: persHandwerk [] — eingebauter Stand bit-identisch zur Nullprobe (${e[s].an.hash})`);
      console.log("  —      (A)-(E) entfallen: Handwerk leer, die Disziplin laeuft unveraendert (Dokument Abschnitt 10).\n");
      continue;
    }
    // (A)
    pruefe(STROEME.every((s) => e[s].an.spielMed >= e[s].aus.spielMed + 0.05),
      `(A) rho je Spiel >= Ist + 0,05 in jedem Strom: ${STROEME.map((s) => `${f3(e[s].aus.spielMed)} -> ${f3(e[s].an.spielMed)} (${(e[s].an.spielMed - e[s].aus.spielMed >= 0 ? "+" : "") + (e[s].an.spielMed - e[s].aus.spielMed).toFixed(3)})`).join(" · ")}`);
    // (B)
    pruefe(STROEME.every((s) => e[s].an.saisonMed > e[s].aus.saisonMed),
      `(B) rho Saison steigt in jedem Strom: ${STROEME.map((s) => `${f3(e[s].aus.saisonMed)} -> ${f3(e[s].an.saisonMed)}`).join(" · ")}`);
    // (C)
    let besser = 0, faelle = 0;
    for (const s of STROEME) e[s].aus.jeP.forEach((p, i) => { faelle++; if (e[s].an.jeP[i].spiel > p.spiel) besser++; });
    const cSchwelle = Math.ceil(faelle * 0.6);
    pruefe(besser >= cSchwelle, `(C) paarweise besser in ${besser} von ${faelle} Paarung-Strom-Faellen (Schwelle ${cSchwelle})`);
    // (D)
    for (const s of STROEME) {
      const a = e[s].aus, b = e[s].an;
      // null (keine Paare >= 15 gemessen) zaehlt als NICHT bestanden, nicht als still OK.
      const dOk = b.starRang1 >= a.starRang1 - 0.03 && b.starTop2 >= a.starTop2 - 0.03
        && a.paartreue != null && b.paartreue != null && b.paartreue >= a.paartreue - 0.03;
      pruefe(dOk, `(D) Strom ${s}: Star R1 ${pct(a.starRang1)} -> ${pct(b.starRang1)}, Top2 ${pct(a.starTop2)} -> ${pct(b.starTop2)}, Paare>=15 ${pct(a.paartreue)} -> ${pct(b.paartreue)} (je hoechstens 3 Pp darunter)`);
    }
    // (E)
    const mT = (k) => STROEME.reduce((x, s) => x + e[s][k].teamTreue, 0) / STROEME.length;
    const eGemessen = STROEME.every((s) => e[s].aus.teamTreue != null && e[s].an.teamTreue != null);
    pruefe(eGemessen && mT("an") >= mT("aus") - 0.05, `(E) Team-Ergebnistreue Mittel der Stroeme ${pct(mT("aus"))} -> ${pct(mT("an"))} (hoechstens 5 Pp darunter)`);
    console.log("");
  }
}
pruefe(fehler.length === 0, `(S) Seitenfehler: ${fehler.length ? fehler.slice(0, 3).join(" | ") : "keine"}`);
console.log(`\n=== GESAMT: ${alleOk ? "ALLE PRUEFUNGEN BESTANDEN" : "MINDESTENS EINE PRUEFUNG FEHLGESCHLAGEN"} ===`);
process.exit(alleOk ? 0 : 1);
