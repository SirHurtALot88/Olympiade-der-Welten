import fs from "fs";
import path from "path";

const PICKS = path.join("outputs", "fresh-pick-audit-10x", "fresh-pick-audit-10x-picks.csv");

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          q = false;
        }
      } else {
        cur += c;
      }
    } else if (c === '"') {
      q = true;
    } else if (c === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

const raw = fs.readFileSync(PICKS, "utf8");
const lines = raw.split(/\r?\n/).filter((l) => l.length);
const header = parseCsvLine(lines[0]);
const idx: Record<string, number> = Object.fromEntries(header.map((h, i) => [h, i]));
const rows = lines.slice(1).map(parseCsvLine);

type TeamAgg = {
  runs: Record<string, Map<string, string>>;
  idFit: number[];
  themeFit: number[];
  roles: Record<string, number>;
  prices: number[];
};
const teams: Record<string, TeamAgg> = {};

for (const r of rows) {
  const team = r[idx.teamId];
  const run = r[idx.run];
  const pid = r[idx.playerId];
  const name = r[idx.playerName];
  if (!teams[team]) teams[team] = { runs: {}, idFit: [], themeFit: [], roles: {}, prices: [] };
  const t = teams[team];
  if (!t.runs[run]) t.runs[run] = new Map();
  t.runs[run].set(pid, name);
  const idf = parseFloat(r[idx.identityFit]);
  if (!Number.isNaN(idf)) t.idFit.push(idf);
  const tf = parseFloat(r[idx.themeFit]);
  if (!Number.isNaN(tf)) t.themeFit.push(tf);
  const role = r[idx.role];
  t.roles[role] = (t.roles[role] || 0) + 1;
  const price = parseFloat(r[idx.price]);
  if (!Number.isNaN(price)) t.prices.push(price);
}

const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

console.log("TEAM | runs | coreAll | union | avgJaccard | idFit | theme | avgPrice | cheap<15");
const summary: { t: string; aj: number; core: number; union: number; idf: number; tf: number }[] = [];
for (const t of Object.keys(teams).sort()) {
  const runIds = Object.keys(teams[t].runs);
  const sets = runIds.map((r) => new Set(teams[t].runs[r].keys()));
  let inter = new Set(sets[0]);
  for (const s of sets.slice(1)) inter = new Set([...inter].filter((x) => s.has(x)));
  const uni = new Set<string>();
  sets.forEach((s) => s.forEach((x) => uni.add(x)));
  const js: number[] = [];
  for (let i = 0; i < sets.length; i++)
    for (let j = i + 1; j < sets.length; j++) {
      const a = sets[i];
      const b = sets[j];
      const I = [...a].filter((x) => b.has(x)).length;
      const U = new Set([...a, ...b]).size;
      js.push(I / U);
    }
  const aj = avg(js);
  const cheap = teams[t].prices.filter((p) => p < 15).length;
  summary.push({ t, aj, core: inter.size, union: uni.size, idf: avg(teams[t].idFit), tf: avg(teams[t].themeFit) });
  console.log(
    `${t} | ${runIds.length} | ${inter.size} | ${uni.size} | ${aj.toFixed(2)} | ${avg(teams[t].idFit).toFixed(1)} | ${avg(teams[t].themeFit).toFixed(1)} | ${avg(teams[t].prices).toFixed(1)} | ${cheap}`,
  );
}

console.log("\n=== AGGREGATE ===");
console.log("avg pairwise Jaccard:", avg(summary.map((s) => s.aj)).toFixed(3));
console.log("avg core (players in ALL 5 runs):", avg(summary.map((s) => s.core)).toFixed(1));
console.log("avg union (distinct players across runs):", avg(summary.map((s) => s.union)).toFixed(1));
console.log("avg identityFit:", avg(summary.map((s) => s.idf)).toFixed(1));
console.log("avg themeFit:", avg(summary.map((s) => s.tf)).toFixed(1));

// Highest-overlap teams (least diverse)
const sorted = [...summary].sort((a, b) => b.aj - a.aj);
console.log("\nLeast diverse (highest Jaccard):");
sorted.slice(0, 6).forEach((s) => console.log(`  ${s.t}: J=${s.aj.toFixed(2)} core=${s.core}`));
console.log("Most diverse (lowest Jaccard):");
sorted.slice(-6).forEach((s) => console.log(`  ${s.t}: J=${s.aj.toFixed(2)} core=${s.core}`));
