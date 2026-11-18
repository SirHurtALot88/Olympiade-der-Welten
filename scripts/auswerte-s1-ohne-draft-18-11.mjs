/* eslint-disable no-console */
/**
 * Auswertung "S1 ohne Draft" (18.11.): Tabellen aus den Rohlaeufen von `miss-teamfinanzen-saison.ts`
 * (`--variante A|C2 [--mischen N]`) und den Diagnosen von `diagnose-s1-kader-und-kasse-18-11.ts`.
 *
 *   node scripts/auswerte-s1-ohne-draft-18-11.mjs  name=lauf.json[,diag-s1.json[,diag-s2.json]]  name2=...
 *
 * Druckt Markdown-Tabellen auf stdout.
 */
import fs from "node:fs";

const r1 = (v) => Math.round(v * 10) / 10;
const r2 = (v) => Math.round(v * 100) / 100;
const sum = (a) => a.reduce((s, v) => s + v, 0);
const sorted = (a) => [...a].sort((x, y) => x - y);
const q = (a, p) => {
  const s = sorted(a);
  if (!s.length) return NaN;
  const i = (s.length - 1) * p;
  const lo = Math.floor(i), hi = Math.ceil(i);
  return s[lo] + (s[hi] - s[lo]) * (i - lo);
};
const med = (a) => q(a, 0.5);
const mean = (a) => (a.length ? sum(a) / a.length : NaN);
function rang(a) {
  const idx = a.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]);
  const r = new Array(a.length);
  idx.forEach(([, i], k) => { r[i] = k; });
  return r;
}
function spearman(x, y) {
  const a = rang(x), b = rang(y), n = x.length;
  const ma = mean(a), mb = mean(b);
  let sab = 0, saa = 0, sbb = 0;
  for (let i = 0; i < n; i += 1) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) ** 2; sbb += (b[i] - mb) ** 2; }
  return saa && sbb ? sab / Math.sqrt(saa * sbb) : 0;
}

const eintraege = process.argv.slice(2).map((a) => {
  const [name, rest] = a.split("=");
  const [lauf, d1, d2] = rest.split(",");
  return { name, lauf: JSON.parse(fs.readFileSync(lauf, "utf8")), d1: d1 ? JSON.parse(fs.readFileSync(d1, "utf8")) : null, d2: d2 ? JSON.parse(fs.readFileSync(d2, "utf8")) : null };
});

const snapVon = (l, key) => (l.phasen[key]?.snap ? Object.values(l.phasen[key].snap) : null);
const kaeufe = (l, key) => {
  const t = l.phasen[key]?.transfers?.byTeam ?? {};
  return sum(Object.values(t).map((v) => v.kaeufe));
};

function pct(l, key, start) {
  const s = snapVon(l, key);
  if (!s) return null;
  return s.map((t) => (100 * t.cash) / start[t.teamId]);
}

const kopf = eintraege.map((e) => e.name);
const zeilen = [];
const add = (label, fn) => zeilen.push([label, ...eintraege.map((e) => { try { const v = fn(e); return v == null || Number.isNaN(v) ? "-" : String(v); } catch { return "-"; } })]);

add("Variante", (e) => e.lauf.variante ?? "A");
add("Reihenfolge", (e) => (e.lauf.reihenfolge ? (e.lauf.reihenfolge[0] === "A-A" ? "fest (A-A zuerst)" : `gemischt (${e.lauf.reihenfolge.slice(0, 3).join(",")}...)`) : "-"));
const staerke = (e) => snapVon(e.lauf, "s1_01_nach_draft").map((t) => t.staerke);
add("Kaderstaerke Mittel (Top-6, Ø 20 Diszi)", (e) => r2(mean(staerke(e))));
add("Kaderstaerke Median", (e) => r2(med(staerke(e))));
add("Kaderstaerke unteres Viertel (P25)", (e) => r2(q(staerke(e), 0.25)));
add("Kaderstaerke oberes Viertel (P75)", (e) => r2(q(staerke(e), 0.75)));
add("Spreizung beste - schlechteste", (e) => r2(Math.max(...staerke(e)) - Math.min(...staerke(e))));
add("Kader Median", (e) => med(snapVon(e.lauf, "s1_01_nach_draft").map((t) => t.kader)));
add("Teams mit Kader < 8", (e) => snapVon(e.lauf, "s1_01_nach_draft").filter((t) => t.kader < 8).length);
add("Teams unter Opt (laut Diagnose)", (e) => e.d1?.teams.filter((t) => t.kader < t.optTarget).length);
add("Fehlende Plaetze bis Opt (Summe)", (e) => e.d1 && sum(e.d1.teams.map((t) => Math.max(0, t.optTarget - t.kader))));
add("Kaeufe gesamt (S1)", (e) => kaeufe(e.lauf, "s1_01_nach_draft"));
add("Gehalt Median (Ist)", (e) => r1(med(snapVon(e.lauf, "s1_01_nach_draft").map((t) => t.gehaltIst))));

const start = (e) => Object.fromEntries(snapVon(e.lauf, "s1_00_nach_anlage").map((t) => [t.teamId, t.cash]));
for (const [key, label] of [["s1_01_nach_draft", "(a) nach S1-Kaderbau"], ["s1_03_nach_spieltagen", "(b) Ende S1 vor Auszahlung"], ["s2_01_nach_kaufphase", "(c) nach S2-Kaufphase"]]) {
  add(`Kasse in % Startbudget ${label}: Median`, (e) => r1(med(pct(e.lauf, key, start(e)))));
  add(`   P10`, (e) => r1(q(pct(e.lauf, key, start(e)), 0.1)));
  add(`   P90`, (e) => r1(q(pct(e.lauf, key, start(e)), 0.9)));
  add(`Kasse absolut ${label}: Median / Mittel`, (e) => { const s = snapVon(e.lauf, key).map((t) => t.cash); return `${r1(med(s))} / ${r1(mean(s))}`; });
}
// Chris' Punkt: Anteil der zu Beginn der S2-Kaufphase vorhandenen Kasse, der danach noch liegt.
const anteilS2 = (e) => {
  const v = snapVon(e.lauf, "s2_00_vor_kaufphase"), n = snapVon(e.lauf, "s2_01_nach_kaufphase");
  if (!v || !n) return null;
  const vm = Object.fromEntries(v.map((t) => [t.teamId, t.cash]));
  return n.map((t) => (100 * t.cash) / vm[t.teamId]);
};
add("S2: Kasse VOR Kaufphase Median", (e) => { const v = snapVon(e.lauf, "s2_00_vor_kaufphase"); return v ? r1(med(v.map((t) => t.cash))) : null; });
add("S2: Kasse NACH Kaufphase Median", (e) => { const v = snapVon(e.lauf, "s2_01_nach_kaufphase"); return v ? r1(med(v.map((t) => t.cash))) : null; });
add("S2: Anteil liegen geblieben (nach/vor) Median %", (e) => r1(med(anteilS2(e))));
add("   P10 / P90", (e) => `${r1(q(anteilS2(e), 0.1))} / ${r1(q(anteilS2(e), 0.9))}`);
add("S2: Kader vor -> nach (Median)", (e) => `${med(snapVon(e.lauf, "s2_00_vor_kaufphase").map((t) => t.kader))} -> ${med(snapVon(e.lauf, "s2_01_nach_kaufphase").map((t) => t.kader))}`);
add("S2: Teams Kader < 8 nach Kaufphase", (e) => snapVon(e.lauf, "s2_01_nach_kaufphase").filter((t) => t.kader < 8).length);
add("S2: Kaeufe (laut Laufprotokoll)", (e) => e.lauf.phasen.s2_01_nach_kaufphase?.lauf?.transferBuysApplied);
add("S2: KI-Teams abgeschlossen von 32", (e) => e.lauf.phasen.s2_01_nach_kaufphase?.lauf?.aiTeamsCompleted);
add("Disziplinen mit >= 1 soliden Spieler (>60), Ø/Team", (e) => r1(mean(e.d1.teams.map((t) => t.diszMind1))));
add("Disziplinen mit >= 3 soliden Spielern, Ø/Team", (e) => r1(mean(e.d1.teams.map((t) => t.diszMind3))));
add("Top-20-Spieler nach Marktwert: gekauft / im Kandidatenpool", (e) => `${e.d1.top20Info.filter((x) => x.gerostert).length} / ${e.d1.top20Info.filter((x) => x.imPool).length} von 20`);
add("Top-20 nach Spitzen-Eignung: gekauft / im Pool", (e) => `${e.d1.top20EigInfo.filter((x) => x.gerostert).length} / ${e.d1.top20EigInfo.filter((x) => x.imPool).length} von 20`);
add("Teams mit >= 1 / >= 2 der Top-20 (MW)", (e) => `${e.d1.teams.filter((t) => t.nTop20 >= 1).length} / ${e.d1.teams.filter((t) => t.nTop20 >= 2).length}`);
add("Teams mit >= 1 / >= 2 der Top-20 (Eignung)", (e) => `${e.d1.teams.filter((t) => t.nTop20Eig >= 1).length} / ${e.d1.teams.filter((t) => t.nTop20Eig >= 2).length}`);
add("Teuerster Spieler im Team-Kader (Marktwert): Median / Max", (e) => `${r1(med(e.d1.teams.map((t) => t.maxMvImKader)))} / ${r1(Math.max(...e.d1.teams.map((t) => t.maxMvImKader)))}`);
add("Teuerster freier Top-20-Spieler (MW)", (e) => r1(Math.max(...e.d1.top20Info.map((x) => x.mv ?? 0))));
add("Erstzugriff: Spearman(Zugriffsposition, Staerke)", (e) => r2(spearman(e.d1.teams.map((t) => t.index), e.d1.teams.map((t) => t.staerke))));
add("Erstzugriff: Staerke erste 8 / letzte 8 Teams", (e) => {
  const s = [...e.d1.teams].sort((a, b) => a.index - b.index);
  return `${r2(mean(s.slice(0, 8).map((t) => t.staerke)))} / ${r2(mean(s.slice(-8).map((t) => t.staerke)))}`;
});

console.log(`| Kennzahl | ${kopf.join(" | ")} |`);
console.log(`|---|${kopf.map(() => "---").join("|")}|`);
for (const z of zeilen) console.log(`| ${z.join(" | ")} |`);

console.log("\n### Kasse nach S1-Kaderbau nach Finanzwert (Anteil am Startbudget)\n");
console.log(`| Finanzwert | ${kopf.map((k) => `${k} n / Median % / Ziel-S1 %`).join(" | ")} |`);
console.log(`|---|${kopf.map(() => "---").join("|")}|`);
const zielS1 = (f) => { const qq = 5 + 20 * (f - 1) / 9; return r1(qq / 2); };
for (let b = 1; b <= 10; b += 1) {
  const zellen = eintraege.map((e) => {
    const s = snapVon(e.lauf, "s1_01_nach_draft").filter((t) => Math.min(10, Math.max(1, Math.round(t.finanzwert))) === b);
    const st = start(e);
    if (!s.length) return "-";
    return `${s.length} / ${r1(med(s.map((t) => (100 * t.cash) / st[t.teamId])))} / ${zielS1(b)}`;
  });
  console.log(`| ${b} | ${zellen.join(" | ")} |`);
}

for (const e of eintraege) {
  for (const [lbl, d] of [["S1-Kaderbau", e.d1], ["S2-Kaufphase", e.d2]]) {
    if (!d) continue;
    const z = {};
    for (const t of d.teams) z[t.grund] = (z[t.grund] ?? 0) + 1;
    const sp = d.teams.map((t) => t.spielraumUeberFloor);
    console.log(`\n### ${e.name}: Grund fuer liegen gebliebene Kasse am Ende ${lbl}\n`);
    console.log(`Gruende (Teams): ${JSON.stringify(z)}; Spielraum Kasse - Floor: Median ${r2(med(sp))}, P10 ${r2(q(sp, 0.1))}, P90 ${r2(q(sp, 0.9))}; Floor Median ${r2(med(d.teams.map((t) => t.floor)))}; Kasse Median ${r2(med(d.teams.map((t) => t.cash)))}`);
  }
}

// ---------------------------------------------------------------------------------------------
// S2-KAUFPHASE: WAS HAELT DAS GELD? Ruecklage zu BEGINN der Kaufphase aus dem Schnappschuss "vor Kaufphase" nachgerechnet
// (Konzept: q(Finanzwert) x (Kasse + Kaderwert), Untergrenze 0,35 x Zielgehalt; ab S2 nicht halbiert). Optziel je Team aus der Diagnose.
// ---------------------------------------------------------------------------------------------
const normF = (f) => Math.min(10, Math.max(1, typeof f === "number" ? (f > 10 ? f / 10 : f) : 5));
for (const e of eintraege) {
  if (!e.d2) continue;
  const v = snapVon(e.lauf, "s2_00_vor_kaufphase"), n = snapVon(e.lauf, "s2_01_nach_kaufphase");
  if (!v || !n) continue;
  const nm = Object.fromEntries(n.map((t) => [t.teamId, t]));
  const dm = Object.fromEntries(e.d2.teams.map((t) => [t.teamId, t]));
  const zeilen2 = v.map((t) => {
    const nach = nm[t.teamId], d = dm[t.teamId];
    const fw = normF(t.finanzwert), opt = d.optTarget, rmax = d.rosterMax;
    const sal = t.gehaltIst, k = t.kader;
    const ziel = k <= 0 ? opt * (3.6 + fw * 0.1) : Math.max(sal + (sal / k) * Math.max(0, opt - k), opt * (3.6 + fw * 0.1));
    const qq = 0.05 + 0.2 * (fw - 1) / 9;
    const rue = Math.max(qq * (t.cash + t.marktwert), 0.35 * ziel);
    const floor = Math.max(5, 0.35 * sal, rue);
    const rest = nach.cash;
    const grund = nach.kader >= rmax ? "kader_voll" : (rest - floor < d.billigster ? "ruecklage_bindet" : (nach.kader >= opt ? "opt_erreicht_stop" : "unter_opt_stop"));
    return { teamId: t.teamId, vor: t.cash, nach: rest, kaderVor: k, kaderNach: nach.kader, opt, floor, rue, spiel: rest - floor, grund, fw, kaufsumme: t.cash - rest, ratio: rest / Math.max(1, nach.gehaltIst), gehaltNach: nach.gehaltIst };
  });
  const z = {};
  for (const r of zeilen2) z[r.grund] = (z[r.grund] ?? 0) + 1;
  console.log(`\n### ${e.name}: S2-Kaufphase, wer haelt Geld (Ruecklage zu Beginn nachgerechnet)\n`);
  console.log(`Gruende: ${JSON.stringify(z)}`);
  console.log(`Kasse vor Median ${r1(med(zeilen2.map((r) => r.vor)))}; nach Median ${r1(med(zeilen2.map((r) => r.nach)))}; Ruecklage-Floor (Soll) Median ${r1(med(zeilen2.map((r) => r.floor)))} = ${r1(med(zeilen2.map((r) => 100 * r.floor / r.vor)))} % der Kasse vor Kauf; Spielraum nach Kauf ueber Floor Median ${r1(med(zeilen2.map((r) => r.spiel)))} (P10 ${r1(q(zeilen2.map((r) => r.spiel), 0.1))}, P90 ${r1(q(zeilen2.map((r) => r.spiel), 0.9))})`);
  console.log(`Teams mit Kader >= Opt nach Kauf: ${zeilen2.filter((r) => r.kaderNach >= r.opt).length}/32; Kader vor Kauf Median ${med(zeilen2.map((r) => r.kaderVor))}, Opt Median ${med(zeilen2.map((r) => r.opt))}`);
  console.log(`Kasse/Gehalt nach Kauf: Median ${r2(med(zeilen2.map((r) => r.ratio)))} (P10 ${r2(q(zeilen2.map((r) => r.ratio), 0.1))}, P90 ${r2(q(zeilen2.map((r) => r.ratio), 0.9))}); Teams mit Kasse/Gehalt >= 1,1 (Schwelle fuer Zusatzkaeufe ueber Opt): ${zeilen2.filter((r) => r.ratio >= 1.1).length}/32; Teams genau auf Opt: ${zeilen2.filter((r) => r.kaderNach === r.opt).length}; ueber Opt: ${zeilen2.filter((r) => r.kaderNach > r.opt).length}; unter Opt: ${zeilen2.filter((r) => r.kaderNach < r.opt).length}`);
  console.log(`Ausgegeben in der Kaufphase: Median ${r1(med(zeilen2.map((r) => r.kaufsumme)))}, Summe ${r1(sum(zeilen2.map((r) => r.kaufsumme)))}; Kasse nach als Vielfaches des Floor: Median ${r2(med(zeilen2.map((r) => r.nach / r.floor)))}`);
  console.log("\n| Finanzwert | n | Kasse vor | Kasse nach | nach % von vor | Floor-Soll % von vor | Kader vor->nach | Opt |\n|---|---|---|---|---|---|---|---|");
  for (const [lo, hi] of [[1, 3.99], [4, 6.99], [7, 10]]) {
    const g = zeilen2.filter((r) => r.fw >= lo && r.fw <= hi);
    if (!g.length) continue;
    console.log(`| ${lo}-${Math.floor(hi)} | ${g.length} | ${r1(med(g.map((r) => r.vor)))} | ${r1(med(g.map((r) => r.nach)))} | ${r1(med(g.map((r) => 100 * r.nach / r.vor)))} | ${r1(med(g.map((r) => 100 * r.floor / r.vor)))} | ${med(g.map((r) => r.kaderVor))}->${med(g.map((r) => r.kaderNach))} | ${med(g.map((r) => r.opt))} |`);
  }
}
