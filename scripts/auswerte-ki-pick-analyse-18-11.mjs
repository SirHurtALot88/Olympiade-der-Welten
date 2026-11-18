/**
 * Auswertung zu `scripts/miss-ki-pick-analyse-18-11.ts` (KI-Pick-Analyse 18.11.).
 *
 *   node scripts/auswerte-ki-pick-analyse-18-11.mjs <lauf.json> [<lauf2.json> ...]
 *
 * Druckt Markdown-Tabellen: Pool, Verteilung nach dem Draft (Kader, Stars, Stufen, Kasse), Abbruchgruende,
 * Identitaet gegen Kaderstruktur (Spearman), Gruppen nach GM-Archetyp und Finanzwert, Solo-Plan gegen echten Draft.
 * Mehrere Laeufe werden gepoolt (je Team-Lauf eine Zeile).
 */
import fs from "node:fs";

const dateien = process.argv.slice(2);
if (dateien.length === 0) {
  console.error("Aufruf: node scripts/auswerte-ki-pick-analyse-18-11.mjs <lauf.json> ...");
  process.exit(1);
}
const laeufe = dateien.map((d) => JSON.parse(fs.readFileSync(d, "utf8")));

const r1 = (v) => (v == null || Number.isNaN(v) ? "–" : (Math.round(v * 10) / 10).toString().replace(".", ","));
const r2 = (v) => (v == null || Number.isNaN(v) ? "–" : (Math.round(v * 100) / 100).toString().replace(".", ","));
const q = (werte, p) => {
  const s = werte.filter((v) => v != null && !Number.isNaN(v)).sort((a, b) => a - b);
  if (s.length === 0) return NaN;
  return s[Math.min(s.length - 1, Math.max(0, Math.round(p * (s.length - 1))))];
};
const median = (w) => q(w, 0.5);
const mittel = (w) => w.reduce((a, b) => a + b, 0) / Math.max(1, w.length);

function raenge(werte) {
  const idx = werte.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
  const r = new Array(werte.length);
  for (let i = 0; i < idx.length; ) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j += 1;
    const rang = (i + j) / 2 + 1;
    for (let k = i; k <= j; k += 1) r[idx[k][1]] = rang;
    i = j + 1;
  }
  return r;
}
function pearson(a, b) {
  const ma = mittel(a);
  const mb = mittel(b);
  let sab = 0;
  let saa = 0;
  let sbb = 0;
  for (let i = 0; i < a.length; i += 1) {
    sab += (a[i] - ma) * (b[i] - mb);
    saa += (a[i] - ma) ** 2;
    sbb += (b[i] - mb) ** 2;
  }
  return saa > 0 && sbb > 0 ? sab / Math.sqrt(saa * sbb) : NaN;
}
function spearman(a, b) {
  const paare = a.map((v, i) => [v, b[i]]).filter(([x, y]) => x != null && y != null && !Number.isNaN(x) && !Number.isNaN(y));
  return pearson(raenge(paare.map((p) => p[0])), raenge(paare.map((p) => p[1])));
}

// ---- Team-Zeilen ----
const zeilen = [];
for (const lauf of laeufe) {
  for (const [teamId, t] of Object.entries(lauf.teams)) {
    const nd = t.nachDraft;
    const id = t.identitaet;
    const gm = t.gm ?? {};
    const sim = lauf.simulation?.jeTeam?.[teamId] ?? null;
    const es = lauf.einzelschritt?.jeTeam?.[teamId] ?? null;
    const stars = (nd.stufen.Superstar ?? 0) + (nd.stufen.Star ?? 0);
    const soloStars = (t.solo.bild.stufen.Superstar ?? 0) + (t.solo.bild.stufen.Star ?? 0);
    zeilen.push({
      lauf: `${lauf.label}/${lauf.draft}`,
      teamId,
      liga: t.liga,
      startKasse: t.startKasse,
      finanzwert: id.finances > 10 ? id.finances / 10 : id.finances,
      ambition: id.ambition > 10 ? id.ambition / 10 : id.ambition,
      vertrauen: id.boardConfidence > 10 ? id.boardConfidence / 10 : id.boardConfidence,
      playerOpt: id.playerOpt,
      optTarget: t.solo.optTarget,
      archetype: gm.archetype ?? "?",
      starPriority: gm.starPriority,
      depthPref: gm.rosterDepthPreference,
      elitePref: gm.eliteSmallRosterPreference,
      valuePriority: gm.valuePriority,
      cashPriority: gm.cashPriority,
      thema: t.themaStrenge,
      wWin: t.solo.gewichte.wWin,
      wThrift: t.solo.gewichte.wThrift,
      wPatience: t.solo.gewichte.wPatience,
      ruecklage: t.solo.ruecklage,
      lizenz: t.solo.superstarLizenz,
      kompStar: t.solo.komposition ? (t.solo.komposition.superstar ?? 0) + (t.solo.komposition.star ?? 0) : null,
      kader: nd.kader,
      stars,
      superstars: nd.stufen.Superstar ?? 0,
      core: nd.stufen.Core ?? 0,
      depth: nd.stufen.Depth ?? 0,
      backupReserve: (nd.stufen.Backup ?? 0) + (nd.stufen.Reserve ?? 0),
      top1: nd.top1Anteil,
      mwMax: nd.mwMax,
      mwMedian: nd.mwMedian,
      mwSumme: nd.marktwertSumme,
      gehalt: nd.gehalt,
      kasse: nd.kasse,
      kasseUeber: nd.kasseUeberRuecklage,
      kasseAnteil: nd.kasseAnteilStart,
      staerke: nd.staerke,
      unterOpt: nd.kader < t.solo.optTarget,
      soloKader: t.solo.bild.kader,
      soloStars,
      soloStaerke: t.solo.bild.staerke,
      soloKasse: t.solo.bild.kasse,
      soloAbbruch: t.solo.abbruch,
      simAbbruch: sim?.abbruch ?? null,
      simPlatz: sim?.platz ?? null,
      simTreffer: t.simTreffer ?? null,
      esGrund: es?.fertigGrund ?? null,
      esPlatz: es?.platzRunde1 ?? null,
      esNot: es?.notkaeufe ?? 0,
      esNach: es?.nachruecker ?? 0,
    });
  }
}

const out = [];
const p = (s = "") => out.push(s);

// ---- Pool ----
p("## Pool");
p("");
p("| Lauf | im Spielstand | frei | kaufbar (MW>0) | billigster | P10 | Median | P90 | teuerster | Σ 8 billigste | leistbar für das ärmste Team | ärmste Kasse | Σ Kassen | Σ Poolwert |");
p("|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|");
for (const l of laeufe) {
  const po = l.pool;
  p(`| ${l.label}/${l.draft} | ${po.spielerImSpielstand} | ${po.frei} | ${po.kaufbarMwGroesser0} | ${r1(po.preis.min)} | ${r1(po.preis.p10)} | ${r1(po.preis.median)} | ${r1(po.preis.p90)} | ${r1(po.preis.max)} | ${r1(po.billigste8Summe)} | ${po.leistbarFuerAermstesTeam} | ${r1(po.aermsteKasse)} | ${r1(po.kassenSumme)} | ${r1(po.poolWertSumme)} |`);
}
p("");
p("Stufen im Pool (Marktwert-Brackets): " + laeufe.map((l) => `${l.label}: ${Object.entries(l.pool.stufen).map(([k, v]) => `${k} ${v}`).join(", ")}`).join(" · "));
p("");

// ---- Verteilung nach dem Draft ----
p("## Verteilung nach dem Draft (je Lauf)");
p("");
p("| Lauf | Teams | Kader Ø (min–max) | unter Opt | Stars Ø (0 / 1 / ≥2) | Superstars Σ | Top-1-Anteil am Kaderwert Median | Kasse Median (min–max) | Kasse in % Start Median | Kasse über Rücklage Median (min–max) | Stärke Ø |");
p("|---|---:|---|---:|---|---:|---:|---|---:|---|---:|");
const laufNamen = [...new Set(zeilen.map((z) => z.lauf))];
for (const ln of laufNamen) {
  const z = zeilen.filter((x) => x.lauf === ln);
  const k = z.map((x) => x.kader);
  const s = z.map((x) => x.stars);
  p(
    `| ${ln} | ${z.length} | ${r1(mittel(k))} (${Math.min(...k)}–${Math.max(...k)}) | ${z.filter((x) => x.unterOpt).length} | ${r2(mittel(s))} (${s.filter((v) => v === 0).length} / ${s.filter((v) => v === 1).length} / ${s.filter((v) => v >= 2).length}) | ${z.reduce((a, x) => a + x.superstars, 0)} | ${r2(median(z.map((x) => x.top1)))} | ${r1(median(z.map((x) => x.kasse)))} (${r1(Math.min(...z.map((x) => x.kasse)))}–${r1(Math.max(...z.map((x) => x.kasse)))}) | ${r1(100 * median(z.map((x) => x.kasseAnteil)))} % | ${r1(median(z.map((x) => x.kasseUeber)))} (${r1(Math.min(...z.map((x) => x.kasseUeber)))}–${r1(Math.max(...z.map((x) => x.kasseUeber)))}) | ${r1(mittel(z.map((x) => x.staerke)))} |`,
  );
}
p("");
p("Kadergröße-Histogramm: " + laufNamen.map((ln) => {
  const h = {};
  for (const x of zeilen.filter((y) => y.lauf === ln)) h[x.kader] = (h[x.kader] ?? 0) + 1;
  return `${ln}: ${Object.entries(h).map(([k, v]) => `${k}er ${v}`).join(", ")}`;
}).join(" · "));
p("");
p("Stufen gesamt nach dem Draft: " + laufNamen.map((ln) => {
  const z = zeilen.filter((x) => x.lauf === ln);
  return `${ln}: Superstar ${z.reduce((a, x) => a + x.superstars, 0)}, Star ${z.reduce((a, x) => a + x.stars - x.superstars, 0)}, Core ${z.reduce((a, x) => a + x.core, 0)}, Depth ${z.reduce((a, x) => a + x.depth, 0)}, Backup/Reserve ${z.reduce((a, x) => a + x.backupReserve, 0)}`;
}).join(" · "));
p("");

// ---- Abbruchgruende ----
p("## Abbruchgründe");
p("");
const zaehle = (werte) => {
  const h = {};
  for (const v of werte) h[v ?? "–"] = (h[v ?? "–"] ?? 0) + 1;
  return Object.entries(h).map(([k, v]) => `${k} ${v}`).join(", ");
};
for (const ln of laufNamen) {
  const z = zeilen.filter((x) => x.lauf === ln);
  p(`* ${ln}: Solo-Plan (voller Pool) — ${zaehle(z.map((x) => x.soloAbbruch))}` + (z[0].simAbbruch != null ? `; Block-Simulation — ${zaehle(z.map((x) => x.simAbbruch))}` : "") + (z[0].esGrund != null ? `; Einzelschritt — ${zaehle(z.map((x) => x.esGrund))}, Notkäufe Σ ${z.reduce((a, x) => a + x.esNot, 0)}, Nachrücker Σ ${z.reduce((a, x) => a + x.esNach, 0)}` : ""));
}
for (const l of laeufe) if (l.einzelschritt) p(`* ${l.label}/einzelschritt Verlauf: ${Object.entries(l.einzelschritt.grundZaehler).map(([k, v]) => `${k} ${v}`).join(", ")}`);
const treffer = zeilen.filter((x) => x.simTreffer);
if (treffer.length > 0) {
  const g = treffer.reduce((a, x) => a + x.simTreffer.gleich, 0);
  const e = treffer.reduce((a, x) => a + x.simTreffer.echt, 0);
  p(`* Block-Simulation gegen echten Blocklauf: ${g} von ${e} Spielern gleich (${r1((100 * g) / Math.max(1, e))} %), Teams mit identischem Kader ${treffer.filter((x) => x.simTreffer.gleich === x.simTreffer.echt && x.simTreffer.sim === x.simTreffer.echt).length} von ${treffer.length}.`);
}
p("");

// ---- Identitaet gegen Struktur ----
p("## Identität gegen Kaderstruktur (Spearman, alle Team-Läufe gepoolt)");
p("");
const merkmale = ["finanzwert", "ambition", "vertrauen", "playerOpt", "optTarget", "starPriority", "depthPref", "elitePref", "valuePriority", "cashPriority", "wWin", "wThrift", "wPatience", "startKasse", "ruecklage"];
const ziele = ["kader", "stars", "top1", "mwMax", "mwMedian", "gehalt", "kasse", "kasseUeber", "kasseAnteil", "staerke"];
for (const ln of laufNamen) {
  const z = zeilen.filter((x) => x.lauf === ln);
  p(`### ${ln} (n = ${z.length})`);
  p("");
  p(`| Merkmal | ${ziele.join(" | ")} |`);
  p(`|---|${ziele.map(() => "---:").join("|")}|`);
  for (const m of merkmale) {
    p(`| ${m} | ${ziele.map((zz) => r2(spearman(z.map((x) => x[m]), z.map((x) => x[zz])))).join(" | ")} |`);
  }
  p("");
}

// ---- Gruppen ----
for (const ln of laufNamen) {
  const z = zeilen.filter((x) => x.lauf === ln);
  p(`## Nach GM-Archetyp — ${ln}`);
  p("");
  p("| Archetyp | Teams | Opt Ø | Kader Ø | Stars Ø | Top-1-Anteil Ø | Kasse über Rücklage Ø | Stärke Ø |");
  p("|---|---:|---:|---:|---:|---:|---:|---:|");
  for (const a of [...new Set(z.map((x) => x.archetype))].sort()) {
    const g = z.filter((x) => x.archetype === a);
    p(`| ${a} | ${g.length} | ${r1(mittel(g.map((x) => x.optTarget)))} | ${r1(mittel(g.map((x) => x.kader)))} | ${r2(mittel(g.map((x) => x.stars)))} | ${r2(mittel(g.map((x) => x.top1)))} | ${r1(mittel(g.map((x) => x.kasseUeber)))} | ${r1(mittel(g.map((x) => x.staerke)))} |`);
  }
  p("");
  p(`## Nach Finanzwert — ${ln}`);
  p("");
  p("| Finanzwert | Teams | Startkasse Ø | Rücklage Ø | Kasse Ø | Kasse über Rücklage Ø | Kader Ø | Stars Ø |");
  p("|---|---:|---:|---:|---:|---:|---:|---:|");
  for (const [name, lo, hi] of [["1–3,9", 0, 4], ["4–6,9", 4, 7], ["7–10", 7, 11]]) {
    const g = z.filter((x) => x.finanzwert >= lo && x.finanzwert < hi);
    if (g.length === 0) continue;
    p(`| ${name} | ${g.length} | ${r1(mittel(g.map((x) => x.startKasse)))} | ${r1(mittel(g.map((x) => x.ruecklage)))} | ${r1(mittel(g.map((x) => x.kasse)))} | ${r1(mittel(g.map((x) => x.kasseUeber)))} | ${r1(mittel(g.map((x) => x.kader)))} | ${r2(mittel(g.map((x) => x.stars)))} |`);
  }
  p("");
}

// ---- Plan gegen Ist (Chris: „wenn C-C 14 picks plant, sollte es am Ende nicht 8 haben") ----
for (const ln of laufNamen) {
  const z = zeilen
    .filter((x) => x.lauf === ln)
    .map((x) => ({
      ...x,
      luecke: x.optTarget - x.kader,
      budgetJePlatz: (x.startKasse - x.ruecklage) / Math.max(1, x.optTarget),
      preisJeSpieler: x.mwSumme / Math.max(1, x.kader),
    }))
    .sort((a, b) => b.luecke - a.luecke || a.teamId.localeCompare(b.teamId));
  const zeigen = z.filter((x, i) => i < 6 || x.teamId === "C-C" || x.teamId === "D-P");
  p(`## Plan gegen Ist — ${ln} (größte Lücken, dazu C-C und D-P)`);
  p("");
  p("| Team | Archetyp | geplant (Opt) | gekauft | Lücke | Abbruch | Budget je geplantem Platz | Ø Preis je gekauftem Spieler | Kasse über Rücklage |");
  p("|---|---|---:|---:|---:|---|---:|---:|---:|");
  for (const x of zeigen) {
    p(`| ${x.teamId} | ${x.archetype} | ${x.optTarget} | ${x.kader} | ${x.luecke} | ${x.simAbbruch ?? x.esGrund ?? x.soloAbbruch} | ${r1(x.budgetJePlatz)} | ${r1(x.preisJeSpieler)} | ${r1(x.kasseUeber)} |`);
  }
  p("");
  p(`Lücke Σ ${z.reduce((a, x) => a + Math.max(0, x.luecke), 0)} Plätze bei ${z.filter((x) => x.luecke > 0).length} Teams; Ø Preis je Spieler über Budget je Platz bei ${z.filter((x) => x.preisJeSpieler > x.budgetJePlatz).length} von ${z.length} Teams.`);
  p("");
}

// ---- Je Team ----
for (const ln of laufNamen) {
  const z = zeilen.filter((x) => x.lauf === ln).sort((a, b) => (a.simPlatz ?? a.esPlatz ?? 0) - (b.simPlatz ?? b.esPlatz ?? 0));
  p(`## Je Team — ${ln}`);
  p("");
  p("| Team | Platz | Archetyp | Fin | Amb | Opt | Startkasse | Rücklage | Kader (Solo) | Stars (Solo) | MW max | Top-1 | Kasse (Solo) | über Rücklage | Stärke (Solo) | Abbruch Solo / echt |");
  p("|---|---:|---|---:|---:|---:|---:|---:|---|---|---:|---:|---|---:|---|---|");
  for (const x of z) {
    p(`| ${x.teamId} | ${x.simPlatz ?? x.esPlatz ?? "–"} | ${x.archetype} | ${r1(x.finanzwert)} | ${r1(x.ambition)} | ${x.optTarget} | ${r1(x.startKasse)} | ${r1(x.ruecklage)} | ${x.kader} (${x.soloKader}) | ${x.stars} (${x.soloStars}) | ${r1(x.mwMax)} | ${r2(x.top1)} | ${r1(x.kasse)} (${r1(x.soloKasse)}) | ${r1(x.kasseUeber)} | ${r1(x.staerke)} (${r1(x.soloStaerke)}) | ${x.soloAbbruch} / ${x.simAbbruch ?? x.esGrund ?? "–"} |`);
  }
  p("");
}

console.log(out.join("\n"));
