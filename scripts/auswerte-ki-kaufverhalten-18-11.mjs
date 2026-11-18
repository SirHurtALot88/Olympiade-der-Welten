/* eslint-disable no-console */
/**
 * Auswertung fuer docs/design/ki-kaufverhalten-analyse-18-11.md. Liest NUR vorhandene Messdaten
 * (data/generated/finanzen-ist-messung-18-11-roh.json + ki-kaufverhalten-stammdaten-18-11.json) und
 * rechnet: Cash je Budget-Klasse nach Draft / nach S2-Kaufphase, Gehalt vs. Sponsor je Team, Zufluss.
 * Keine Spiellogik, keine neuen Laeufe.   node scripts/auswerte-ki-kaufverhalten-18-11.mjs [--json]
 */
import fs from "node:fs";

const roh = JSON.parse(fs.readFileSync("data/generated/finanzen-ist-messung-18-11-roh.json", "utf8")).laeufe;
const stamm = JSON.parse(fs.readFileSync("data/generated/ki-kaufverhalten-stammdaten-18-11.json", "utf8")).teams;

const r1 = (v) => Math.round(v * 10) / 10;
const sum = (a) => a.reduce((s, x) => s + x, 0);
const mean = (a) => (a.length ? sum(a) / a.length : NaN);
const med = (a) => {
  if (!a.length) return NaN;
  const s = [...a].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const q = (a, p) => {
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.max(0, Math.round((s.length - 1) * p)))];
};
const corr = (x, y) => {
  const mx = mean(x), my = mean(y);
  let n = 0, dx = 0, dy = 0;
  for (let i = 0; i < x.length; i++) { n += (x[i] - mx) * (y[i] - my); dx += (x[i] - mx) ** 2; dy += (y[i] - my) ** 2; }
  return n / Math.sqrt(dx * dy);
};

// Budget-Klassen: je Liga Terzile nach Budget (5/6/5 von 16): reich / mittel / arm.
const teamIds = Object.keys(stamm);
const klasse = {};
for (const liga of ["liga1", "liga2"]) {
  const ids = teamIds.filter((t) => stamm[t].liga === liga).sort((a, b) => stamm[b].budget - stamm[a].budget || a.localeCompare(b));
  ids.forEach((t, i) => { klasse[t] = i < 5 ? "reich" : i < 11 ? "mittel" : "arm"; });
}
const KL = ["reich", "mittel", "arm"];

const out = { klassen: {}, gehaltVsSponsor: {}, zufluss: {} };

// ---- Q2: Cash je Klasse ----
const zeilen = [];
for (const liga of ["liga1", "liga2"]) {
  for (const k of KL) {
    const ids = teamIds.filter((t) => stamm[t].liga === liga && klasse[t] === k);
    const bud = ids.map((t) => stamm[t].budget);
    const row = { liga, klasse: k, n: ids.length, budgetMin: Math.min(...bud), budgetMax: Math.max(...bud), budgetMittel: r1(mean(bud)) };
    const draftCash = [], draftPct = [], gehalt = [], cashZuGehalt = [];
    for (const L of ["A", "B", "C"]) {
      const snap = roh[L].roh.phasen.s1_01_nach_draft.snap;
      for (const t of ids) {
        draftCash.push(snap[t].cash);
        draftPct.push((snap[t].cash / snap[t].budget) * 100);
        gehalt.push(snap[t].gehaltIst);
        cashZuGehalt.push(snap[t].cash / snap[t].gehaltIst);
      }
    }
    row.draftCashMed = r1(med(draftCash)); row.draftCashMin = r1(Math.min(...draftCash)); row.draftCashMax = r1(Math.max(...draftCash));
    row.draftPctMed = r1(med(draftPct)); row.gehaltMed = r1(med(gehalt)); row.cashZuGehaltMed = Math.round(med(cashZuGehalt) * 100) / 100;
    // S2 (nur B, C sauber): vor / nach Kaufphase
    const vor = [], nach = [], nachPct = [], kader = [], kaderVor = [], kredit = [];
    for (const L of ["B", "C"]) {
      const ph = roh[L].roh.phasen;
      if (!ph.s2_01_nach_kaufphase) continue;
      for (const t of ids) {
        vor.push(ph.s2_00_vor_kaufphase.snap[t].cash);
        nach.push(ph.s2_01_nach_kaufphase.snap[t].cash);
        nachPct.push((ph.s2_01_nach_kaufphase.snap[t].cash / Math.max(1, ph.s2_00_vor_kaufphase.snap[t].cash)) * 100);
        kader.push(ph.s2_01_nach_kaufphase.snap[t].kader);
        kaderVor.push(ph.s2_00_vor_kaufphase.snap[t].kader);
        kredit.push(ph.s2_01_nach_kaufphase.snap[t].schuld);
      }
    }
    row.s2VorMed = r1(med(vor)); row.s2NachMed = r1(med(nach)); row.s2NachMin = r1(Math.min(...nach)); row.s2NachMax = r1(Math.max(...nach));
    row.s2KaderVor = r1(mean(kaderVor)); row.s2KaderNach = r1(mean(kader)); row.s2SchuldMean = r1(mean(kredit));
    row.s2MitKredit = kredit.filter((x) => x > 0).length + "/" + kredit.length;
    zeilen.push(row);
  }
}
out.klassen = zeilen;

// ---- Q3: Gehalt vs Sponsor je Team (S1) ----
const g = [];
for (const L of ["A", "B", "C"]) {
  const ph = roh[L].roh.phasen;
  const snap = ph.s1_01_nach_draft.snap;
  const guv = ph.s1_04_nach_abschluss.guv;
  for (const t of teamIds) {
    const sp = guv[t].guv.posten.find((p) => p.key === "sponsor")?.amount ?? 0;
    const apron = guv[t].guv.posten.find((p) => p.key === "apron")?.amount ?? 0;
    const gehalt = snap[t].gehaltIst;
    g.push({ L, t, liga: stamm[t].liga, klasse: klasse[t], budget: stamm[t].budget, gehalt, sponsor: sp, ratio: sp > 0 ? sp / gehalt : null, kader: snap[t].kader,
      amb: stamm[t].identity?.ambition, fin: stamm[t].identity?.finances, anchor: stamm[t].sponsor?.anchor ?? null, apron,
      startRank: stamm[t].startRank, endRank: ph.s1_04_nach_abschluss.snap[t].rank });
  }
}
const mitSp = g.filter((x) => x.ratio != null);
out.gehaltVsSponsor.verteilung = { n: mitSp.length, p10: q(mitSp.map((x) => x.ratio), 0.1), p25: q(mitSp.map((x) => x.ratio), 0.25), med: med(mitSp.map((x) => x.ratio)), p75: q(mitSp.map((x) => x.ratio), 0.75), p90: q(mitSp.map((x) => x.ratio), 0.9), unter1: mitSp.filter((x) => x.ratio < 1).length, unter08: mitSp.filter((x) => x.ratio < 0.8).length, ueber12: mitSp.filter((x) => x.ratio > 1.2).length };
const buckets = [[0, 0.7], [0.7, 0.85], [0.85, 1.0], [1.0, 1.15], [1.15, 1.3], [1.3, 9]];
out.gehaltVsSponsor.histogramm = buckets.map(([a, b]) => ({ von: a, bis: b, n: mitSp.filter((x) => x.ratio >= a && x.ratio < b).length }));
out.gehaltVsSponsor.nachKlasse = KL.map((k) => { const s = mitSp.filter((x) => x.klasse === k); return { klasse: k, n: s.length, ratioMed: Math.round(med(s.map((x) => x.ratio)) * 100) / 100, gehaltMed: r1(med(s.map((x) => x.gehalt))), sponsorMed: r1(med(s.map((x) => x.sponsor))), unter1: s.filter((x) => x.ratio < 1).length }; });
out.gehaltVsSponsor.nachLiga = ["liga1", "liga2"].map((l) => { const s = mitSp.filter((x) => x.liga === l); return { liga: l, n: s.length, ratioMed: Math.round(med(s.map((x) => x.ratio)) * 100) / 100, unter1: s.filter((x) => x.ratio < 1).length }; });
out.gehaltVsSponsor.nachLigaKlasse = ["liga1", "liga2"].flatMap((l) => KL.map((k) => { const s = mitSp.filter((x) => x.liga === l && x.klasse === k); return { liga: l, klasse: k, n: s.length, ratioMed: Math.round(med(s.map((x) => x.ratio)) * 100) / 100, deckungSumme: Math.round((sum(s.map((x) => x.sponsor)) / sum(s.map((x) => x.gehalt))) * 100) / 100, gehaltMed: r1(med(s.map((x) => x.gehalt))), sponsorMed: r1(med(s.map((x) => x.sponsor))), unter1: s.filter((x) => x.ratio < 1).length }; }));
out.gehaltVsSponsor.korrelationen = {
  ratio_budget: Math.round(corr(mitSp.map((x) => x.ratio), mitSp.map((x) => x.budget)) * 100) / 100,
  ratio_gehalt: Math.round(corr(mitSp.map((x) => x.ratio), mitSp.map((x) => x.gehalt)) * 100) / 100,
  ratio_ambition: Math.round(corr(mitSp.map((x) => x.ratio), mitSp.map((x) => x.amb)) * 100) / 100,
  ratio_finances: Math.round(corr(mitSp.map((x) => x.ratio), mitSp.map((x) => x.fin)) * 100) / 100,
  ratio_kader: Math.round(corr(mitSp.map((x) => x.ratio), mitSp.map((x) => x.kader)) * 100) / 100,
  gehalt_anchor: Math.round(corr(mitSp.filter((x) => x.anchor != null).map((x) => x.gehalt), mitSp.filter((x) => x.anchor != null).map((x) => x.anchor)) * 100) / 100,
  sponsor_anchor: Math.round(corr(mitSp.filter((x) => x.anchor != null).map((x) => x.sponsor), mitSp.filter((x) => x.anchor != null).map((x) => x.anchor)) * 100) / 100,
};
// Anker (Erwartungswert des gewaehlten Sponsors, vor dem Draft bekannt) vs. real gezahlt
const ak = mitSp.filter((x) => x.anchor != null);
out.gehaltVsSponsor.ankerVsReal = { n: ak.length, ankerMed: r1(med(ak.map((x) => x.anchor))), realMed: r1(med(ak.map((x) => x.sponsor))), real_zu_anker_med: Math.round(med(ak.map((x) => x.sponsor / x.anchor)) * 100) / 100 };
// Gehalt/Anker (so hatte ein Gehaltsdeckel relativ zum Sponsor gewirkt)
out.gehaltVsSponsor.gehaltZuAnker = { med: Math.round(med(ak.map((x) => x.gehalt / x.anchor)) * 100) / 100, p90: Math.round(q(ak.map((x) => x.gehalt / x.anchor), 0.9) * 100) / 100, ueber1: ak.filter((x) => x.gehalt > x.anchor).length };
// Deckel-Szenarien: Gehalt <= k * 0,92 * Anker (Anker = Erwartungswert des gewaehlten Sponsors, vor dem Draft bekannt)
out.gehaltVsSponsor.deckelSzenarien = [0.9, 1.0, 1.1, 1.2, 1.3].map((k) => {
  const drueber = ak.filter((x) => x.gehalt > k * 0.92 * x.anchor);
  const kappung = drueber.map((x) => x.gehalt - k * 0.92 * x.anchor);
  return { k, teamLaeufeUeberDeckel: drueber.length, von: ak.length, kappungMed: r1(med(kappung)), kappungSumme: r1(sum(kappung)), davonLiga1: drueber.filter((x) => x.liga === "liga1").length };
});
// Wer ueberzieht: Top 12 nach Defizit
out.gehaltVsSponsor.ueberzieher = [...mitSp].sort((a, b) => a.ratio - b.ratio).slice(0, 14).map((x) => ({ lauf: x.L, team: x.t, liga: x.liga, klasse: x.klasse, budget: x.budget, gehalt: r1(x.gehalt), sponsor: r1(x.sponsor), ratio: Math.round(x.ratio * 100) / 100, kader: x.kader, amb: x.amb, fin: x.fin, anchor: x.anchor, startRank: x.startRank, endRank: x.endRank }));
// Haeufige Wiederholer (Team in >=2 Laeufen unter 0.9)
const wiederholer = {};
for (const x of mitSp) if (x.ratio < 0.9) wiederholer[x.t] = (wiederholer[x.t] ?? 0) + 1;
out.gehaltVsSponsor.wiederholer = Object.entries(wiederholer).filter(([, n]) => n >= 2).map(([t, n]) => ({ team: t, laeufe: n, budget: stamm[t].budget, fin: stamm[t].identity?.finances, amb: stamm[t].identity?.ambition }));
// Bei gleichem Gehalt: Sponsor-Ersparnis nach Startrang? Gehalt vs Startrang
out.gehaltVsSponsor.gehalt_startrang = Math.round(corr(mitSp.filter((x) => x.startRank != null).map((x) => x.gehalt), mitSp.filter((x) => x.startRank != null).map((x) => x.startRank)) * 100) / 100;

// ---- Q4: Zufluss ----
const z = {};
for (const L of ["A", "B", "C"]) {
  const ph = roh[L].roh.phasen;
  const neb = roh[L].nebendaten;
  z[L] = {
    kasseDraft: r1(sum(Object.values(ph.s1_01_nach_draft.snap).map((s) => s.cash))),
    kasseNachAbrechnung: r1(sum(Object.values(ph.s1_04_nach_abschluss.snap).map((s) => s.cash))),
    marktwertDraft: r1(sum(Object.values(ph.s1_01_nach_draft.snap).map((s) => s.marktwert))),
    transfersNachQuelle: neb.transfersNachQuelle,
  };
}
out.zufluss = z;

if (process.argv.includes("--json")) console.log(JSON.stringify(out, null, 1));
else {
  console.log("== Q2 Cash je Klasse ==");
  console.table(out.klassen);
  console.log("== Q3 ==");
  console.log(JSON.stringify(out.gehaltVsSponsor, null, 1));
  console.log("== Q4 ==");
  console.log(JSON.stringify(out.zufluss, null, 1).slice(0, 4000));
}
