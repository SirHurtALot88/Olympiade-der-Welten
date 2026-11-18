/**
 * A/B-Auswertung fuer Finanzkonzept V2 (Stufen 0 bis 3): liest Rohdaten von
 * `scripts/miss-teamfinanzen-saison.ts` und gibt Markdown-Tabellen aus.
 *
 *   node scripts/vergleiche-finanzen-v2.mjs --paar vorher1.json,nachher1.json [--paar vorher2.json,nachher2.json ...]
 *
 * Je Paar: gleiche Anlage-Basis (gleiche saveId), nur die Schalter OLY_KI_RUECKLAGE_V2 / OLY_KI_FORECAST_SPONSOR /
 * OLY_VORSTAND_BUDGET unterscheiden sich. Alle Zahlen werden ueber die Paare gepoolt (Team-Laeufe).
 *
 * Abbruchkriterium (Auftrag Chris, 18.11.): Kaderstaerke im Median um mehr als 5 % gefallen oder Kader unter dem
 * Minimum (8) -> NICHT mergen. Das Skript meldet beides am Ende.
 */
import fs from "node:fs";

const paare = [];
for (let i = 0; i < process.argv.length; i += 1) {
  if (process.argv[i] === "--paar") {
    const [a, b] = process.argv[i + 1].split(",");
    paare.push({ vorher: JSON.parse(fs.readFileSync(a, "utf8")), nachher: JSON.parse(fs.readFileSync(b, "utf8")) });
  }
}
if (paare.length === 0) throw new Error("mindestens ein --paar vorher.json,nachher.json");

const KADER_MIN = 8;
const r1 = (v) => (v == null || !Number.isFinite(v) ? "—" : (Math.round(v * 10) / 10).toFixed(1));
const r2 = (v) => (v == null || !Number.isFinite(v) ? "—" : (Math.round(v * 100) / 100).toFixed(2));
const pct = (v) => (v == null || !Number.isFinite(v) ? "—" : `${(v * 100).toFixed(1)} %`);
const quantil = (arr, q) => {
  const a = arr.filter((x) => Number.isFinite(x)).sort((x, y) => x - y);
  if (a.length === 0) return null;
  const pos = (a.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return a[lo] + (a[hi] - a[lo]) * (pos - lo);
};
const median = (arr) => quantil(arr, 0.5);
const mittel = (arr) => (arr.length ? arr.reduce((x, y) => x + y, 0) / arr.length : null);

/** Finanzwert-Klasse wie im Konzept (5.2): bis 3, 3 bis 7, ab 7. */
const fwKlasse = (fw) => (fw == null ? "?" : fw < 3 ? "FW < 3" : fw < 7 ? "FW 3 bis 7" : "FW ab 7");
const FW_KLASSEN = ["FW < 3", "FW 3 bis 7", "FW ab 7"];

function zeilen(lauf, phase) {
  const p = lauf.phasen?.[phase];
  return p?.snap ? Object.values(p.snap) : [];
}

function pool(variante, phase) {
  return paare.flatMap((p) => zeilen(p[variante], phase).map((z) => ({ ...z, _paar: paare.indexOf(p) })));
}

function tabelleKlassen(titel, phase, spalten) {
  console.log(`\n### ${titel}\n`);
  console.log(`| Klasse | n | ${spalten.map((s) => `${s.name} vorher | ${s.name} nachher`).join(" | ")} |`);
  console.log(`|---|---:|${spalten.map(() => "---:|---:").join("|")}|`);
  const v = pool("vorher", phase);
  const n = pool("nachher", phase);
  for (const klasse of [...FW_KLASSEN, "alle"]) {
    const f = (rows) => (klasse === "alle" ? rows : rows.filter((z) => fwKlasse(z.finanzwert) === klasse));
    const fv = f(v);
    const fn = f(n);
    console.log(`| ${klasse} | ${fv.length} | ${spalten.map((s) => `${s.fmt(s.f(fv))} | ${s.fmt(s.f(fn))}`).join(" | ")} |`);
  }
}

const abbruch = [];

// ---------------------------------------------------------------- Draft (Saison 1)
console.log(`# A/B-Messung Finanzkonzept V2 Stufe 0 bis 3 (${paare.length} Paar(e), je 32 KI-Teams)`);
console.log(`\nSaaten: ${paare.map((p) => p.vorher.saveId).join(", ")}`);

tabelleKlassen("Saison 1, nach dem Draft: Cash und Kader", "s1_01_nach_draft", [
  { name: "Cash C (Median)", f: (r) => median(r.map((z) => z.cash)), fmt: r1 },
  { name: "Cash % Budget (Median)", f: (r) => median(r.map((z) => z.cash / z.budget)), fmt: pct },
  { name: "Kader (Median)", f: (r) => median(r.map((z) => z.kader)), fmt: r1 },
  { name: "Kader min", f: (r) => (r.length ? Math.min(...r.map((z) => z.kader)) : null), fmt: r1 },
  { name: "Gehalt (Median)", f: (r) => median(r.map((z) => z.gehaltIst)), fmt: r1 },
]);

tabelleKlassen("Saison 1, nach dem Draft: Sponsor-Deckung (erwarteter Sponsor 0,92 x Anker / Gehalt)", "s1_01_nach_draft", [
  {
    name: "Quote (Median)",
    f: (r) => median(r.filter((z) => z.sponsorAnker && z.gehaltIst > 0).map((z) => (0.92 * z.sponsorAnker) / z.gehaltIst)),
    fmt: r2,
  },
  {
    name: "Teams mit Quote < 0,8",
    f: (r) => r.filter((z) => z.sponsorAnker && z.gehaltIst > 0 && (0.92 * z.sponsorAnker) / z.gehaltIst < 0.8).length,
    fmt: (x) => String(x),
  },
]);

// Kaderstaerke je Disziplin
function staerkeAuswertung(phase) {
  const ergebnis = {};
  for (const variante of ["vorher", "nachher"]) {
    const jeDisziplin = {};
    for (const p of paare) {
      const detail = p[variante].phasen?.[phase]?.staerkeDetail;
      if (!detail) continue;
      for (const werte of Object.values(detail)) {
        for (const [d, w] of Object.entries(werte)) (jeDisziplin[d] ??= []).push(w);
      }
    }
    const medianJeDisziplin = Object.values(jeDisziplin).map((arr) => median(arr));
    const p25JeDisziplin = Object.values(jeDisziplin).map((arr) => quantil(arr, 0.25));
    ergebnis[variante] = {
      median: mittel(medianJeDisziplin),
      p25: mittel(p25JeDisziplin),
      jeDisziplin: Object.fromEntries(Object.entries(jeDisziplin).map(([d, arr]) => [d, { median: median(arr), p25: quantil(arr, 0.25) }])),
    };
  }
  return ergebnis;
}

function staerkeTabelle(titel, phase) {
  const s = staerkeAuswertung(phase);
  if (!s.vorher.median || !s.nachher.median) return null;
  const dMed = s.nachher.median / s.vorher.median - 1;
  const dP25 = s.nachher.p25 / s.vorher.p25 - 1;
  console.log(`\n### ${titel}\n`);
  console.log("Top-6-Eignung je Disziplin und Team (fehlende Plaetze zaehlen 0); je Disziplin Median bzw. unterstes Viertel (P25) ueber alle Team-Laeufe, dann Mittel ueber die Disziplinen.\n");
  console.log("| Kennzahl | vorher | nachher | Aenderung |");
  console.log("|---|---:|---:|---:|");
  console.log(`| Median (Mittel ueber Disziplinen) | ${r2(s.vorher.median)} | ${r2(s.nachher.median)} | ${pct(dMed)} |`);
  console.log(`| Unterstes Viertel P25 | ${r2(s.vorher.p25)} | ${r2(s.nachher.p25)} | ${pct(dP25)} |`);
  const schlechteste = Object.keys(s.vorher.jeDisziplin)
    .map((d) => ({ d, delta: s.nachher.jeDisziplin[d].median / s.vorher.jeDisziplin[d].median - 1 }))
    .sort((a, b) => a.delta - b.delta)
    .slice(0, 3);
  console.log(`\nGroesster Rueckgang je Disziplin (Median): ${schlechteste.map((x) => `${x.d} ${pct(x.delta)}`).join(", ")}`);
  return { dMed, dP25 };
}

const st1 = staerkeTabelle("Kaderstaerke nach dem Draft (Saison 1)", "s1_01_nach_draft");
if (st1 && st1.dMed < -0.05) abbruch.push(`Kaderstaerke S1 nach Draft: Median ${pct(st1.dMed)} (Grenze -5 %)`);

// Teams unter Minimum
for (const phase of ["s1_01_nach_draft", "s2_01_nach_kaufphase"]) {
  for (const variante of ["vorher", "nachher"]) {
    const rows = pool(variante, phase);
    if (rows.length === 0) continue;
    const unter = rows.filter((z) => z.kader < KADER_MIN).length;
    console.log(`\nKader unter Minimum (${KADER_MIN}) — ${phase}, ${variante}: ${unter} von ${rows.length}`);
    if (variante === "nachher" && unter > 0) {
      const unterVorher = pool("vorher", phase).filter((z) => z.kader < KADER_MIN).length;
      if (unter > unterVorher) abbruch.push(`${phase}: ${unter} Kader unter Minimum (vorher ${unterVorher})`);
    }
  }
}

// ---------------------------------------------------------------- Saison 2 Kaufphase
if (pool("vorher", "s2_01_nach_kaufphase").length > 0) {
  tabelleKlassen("Saison 2, vor der Kaufphase: Vorstandsvertrauen und Kasse", "s2_00_vor_kaufphase", [
    { name: "Vertrauen (Median)", f: (r) => median(r.map((z) => z.vertrauen)), fmt: r2 },
    { name: "Cash C (Median)", f: (r) => median(r.map((z) => z.cash)), fmt: r1 },
    { name: "Kader (Median)", f: (r) => median(r.map((z) => z.kader)), fmt: r1 },
  ]);
  tabelleKlassen("Saison 2, nach der Kaufphase: Cash und Kader", "s2_01_nach_kaufphase", [
    { name: "Cash C (Median)", f: (r) => median(r.map((z) => z.cash)), fmt: r1 },
    { name: "Cash % (Kasse / (Kasse + Kaderwert))", f: (r) => median(r.map((z) => z.cash / Math.max(1, z.cash + z.marktwert))), fmt: pct },
    { name: "Kader (Median)", f: (r) => median(r.map((z) => z.kader)), fmt: r1 },
    { name: "Kader min", f: (r) => (r.length ? Math.min(...r.map((z) => z.kader)) : null), fmt: r1 },
    { name: "Gehalt (Median)", f: (r) => median(r.map((z) => z.gehaltIst)), fmt: r1 },
  ]);
  const st2 = staerkeTabelle("Kaderstaerke nach der Kaufphase (Saison 2)", "s2_01_nach_kaufphase");
  if (st2 && st2.dMed < -0.05) abbruch.push(`Kaderstaerke S2 nach Kaufphase: Median ${pct(st2.dMed)} (Grenze -5 %)`);

  // Vorstand: Verteilung der Stufen
  const stufen = (rows) => {
    const z = { hoch: 0, mittel: 0, niedrig: 0, sparauflage: 0 };
    for (const r of rows) {
      const v = r.vertrauen;
      if (v == null) continue;
      z[v >= 6 ? "hoch" : v >= 4 ? "mittel" : v >= 2.5 ? "niedrig" : "sparauflage"] += 1;
    }
    return z;
  };
  console.log(`\nVorstand-Stufen zu Beginn der Kaufphase Saison 2 (nachher-Laeufe): ${JSON.stringify(stufen(pool("nachher", "s2_00_vor_kaufphase")))}`);
}

// ---------------------------------------------------------------- Saison-1-Ergebnis (Sponsor, GuV)
if (pool("vorher", "s1_04_nach_abschluss").length > 0) {
  console.log("\n### Saison 1, Abrechnung: Sponsor gegen Gehalt (aus der einen GuV)\n");
  console.log("| Variante | Median Sponsor / Gehalt | Teams mit Quote < 0,9 | Σ GuV Liga | Teams im Minus (Kasse) |");
  console.log("|---|---:|---:|---:|---:|");
  for (const variante of ["vorher", "nachher"]) {
    const q = [];
    let guvSumme = 0;
    let minus = 0;
    let n = 0;
    for (const p of paare) {
      const ph = p[variante].phasen?.["s1_04_nach_abschluss"];
      if (!ph?.guv) continue;
      for (const g of Object.values(ph.guv)) {
        const parts = g.parts ?? {};
        const guv = g.guv ?? {};
        const sponsor = parts.sponsorCash ?? parts.sponsor ?? null;
        const gehalt = parts.salaryTotal ?? parts.gehalt ?? null;
        if (sponsor != null && gehalt > 0) q.push(sponsor / gehalt);
        guvSumme += guv.ergebnis ?? guv.total ?? guv.saldo ?? 0;
        n += 1;
      }
      for (const z of Object.values(ph.snap)) if (z.cash < 0) minus += 1;
    }
    console.log(`| ${variante} | ${r2(median(q))} | ${q.filter((x) => x < 0.9).length} von ${q.length} | ${r1(guvSumme / Math.max(1, paare.length))} | ${minus} von ${n} |`);
  }
}

console.log("\n## Abbruchkriterien\n");
if (abbruch.length === 0) console.log("Keines ausgeloest (Kaderstaerke-Median nicht um mehr als 5 % gefallen, kein Kader zusaetzlich unter dem Minimum).");
else for (const a of abbruch) console.log(`- AUSGELOEST: ${a}`);
