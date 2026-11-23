// Offline-Vergleich von Teammarke-Varianten (22.11., Schere reich/arm) auf den Zahlen eines Messlaufs (miss-teamfinanzen-saison.ts, Phase 03/04).
// Marketing beeinflusst den Spielverlauf nicht: GuV mit = GuV ohne + Teammarke(Variante) + Team-Anteile (nach Deckel).
// AUFRUF: node scripts/vergleiche-marketing-varianten.mjs <saison s1|s2> <lauf.json> [lauf2.json ...]
import fs from "node:fs";

const [saison, ...pfade] = process.argv.slice(2);
const klemme = (x, a, b) => Math.max(a, Math.min(b, x));
const mittel = (l) => (l.length ? l.reduce((a, b) => a + b, 0) / l.length : 0);
const r1 = (x) => Math.round(x * 10) / 10;
const r2 = (x) => Math.round(x * 100) / 100;

const VARIANTEN = {
  "alt (pauschal 4,0)": () => () => 4,
  "A Finanzwert k=0,4 (2..6)": () => (t) => klemme(4 + 0.4 * (5.1 - t.fw), 2, 6),
  "B Finanzwert k=0,8 (0..8)": () => (t) => klemme(4 + 0.8 * (5.1 - t.fw), 0, 8),
  "C Ausgleich: 4 + 0,5 x (Ligamittel Team-Anteil - eigener)": (ctx) => (t) => klemme(4 + 0.5 * (ctx.taMittel[t.liga] - t.ta), 0, 8),
  "D Ausgleich 1,0 (Summe je Liga gleich)": (ctx) => (t) => klemme(4 + 1.0 * (ctx.taMittel[t.liga] - t.ta), 0, 9),
  "F Budget-Rang in der Liga k=0,3": () => (t) => klemme(4 + 0.3 * (t.rang - 8.5), 0, 9),
  "G Budget-Rang in der Liga k=0,5": () => (t) => klemme(4 + 0.5 * (t.rang - 8.5), 0, 9),
  "H Budget-Rang k=0,3 + Ausgleich 0,5": (ctx) => (t) => klemme(4 + 0.3 * (t.rang - 8.5) + 0.5 * (ctx.taMittel[t.liga] - t.ta), 0, 9),
  "I Liga 3,0/5,5 + Rang k=0,5": () => (t) => klemme((t.liga === "liga1" ? 3.0 : 5.5) + 0.5 * (t.rang - 8.5), 0, 9),
  "J Liga 3,5/5,5 + Rang k=0,4": () => (t) => klemme((t.liga === "liga1" ? 3.5 : 5.5) + 0.4 * (t.rang - 8.5), 0, 9),
  "K Liga 3,5/5,0 + Rang k=0,4": () => (t) => klemme((t.liga === "liga1" ? 3.5 : 5.0) + 0.4 * (t.rang - 8.5), 0, 9),
  "L Liga 3,0/5,0 + Rang k=0,5": () => (t) => klemme((t.liga === "liga1" ? 3.0 : 5.0) + 0.5 * (t.rang - 8.5), 0, 9),
  "M Liga 3,5/6,0 + Rang k=0,5": () => (t) => klemme((t.liga === "liga1" ? 3.5 : 6.0) + 0.5 * (t.rang - 8.5), 0, 9),
  "E Finanzwert k=0,4 + Ausgleich 0,5": (ctx) => (t) => klemme(4 + 0.4 * (5.1 - t.fw) + 0.5 * (ctx.taMittel[t.liga] - t.ta), 0, 9),
};

for (const pfad of pfade) {
  const lauf = JSON.parse(fs.readFileSync(pfad, "utf8"));
  const ph = (n) => Object.entries(lauf.phasen).find(([k]) => k.startsWith(`${saison}_${n}`))?.[1];
  const spiel = ph("03_nach_spieltagen");
  const guv = ph("04_nach_abschluss")?.guv;
  if (!spiel?.marketing || !guv) continue;
  const ids = Object.keys(guv);
  const teams = ids.map((id) => ({
    id,
    liga: spiel.marketing[id].liga,
    ta: Math.min(spiel.marketing[id].teamAnteile, 12),
    fw: spiel.snap[id].finanzwert ?? 5.1,
    budget: spiel.snap[id].budget,
    ohne: guv[id].guv.guv,
    einn: guv[id].guv.einnahmen,
  }));
  for (const liga of ["liga1", "liga2"]) {
    teams.filter((t) => t.liga === liga).sort((a, b) => b.budget - a.budget).forEach((t, i) => { t.rang = i + 1; });
  }
  const ctx = { taMittel: {} };
  for (const liga of ["liga1", "liga2"]) ctx.taMittel[liga] = mittel(teams.filter((t) => t.liga === liga).map((t) => t.ta));
  const sortiert = [...teams].sort((a, b) => b.budget - a.budget);
  console.log(`\n${pfad.split("/").pop()} ${saison}`);
  console.log("Variante | Marketing Summe | GuV>=0 ohne->mit | Einnahmen L1:L2 ohne->mit | GuV-Abstand reiche8-arme8 Delta | Marketing reiche8/arme8 | Teammarke Summe L1/L2 je Team");
  for (const [name, bau] of Object.entries(VARIANTEN)) {
    const f = bau(ctx);
    const mk = (t) => f(t) + t.ta;
    const verh = (m) => mittel(teams.filter((t) => t.liga === "liga1").map((t) => t.einn + (m ? mk(t) : 0))) / mittel(teams.filter((t) => t.liga === "liga2").map((t) => t.einn + (m ? mk(t) : 0)));
    const abst = (g) => mittel(sortiert.slice(0, 8).map(g)) - mittel(sortiert.slice(-8).map(g));
    console.log(
      `${name} | ${r1(teams.reduce((s, t) => s + mk(t), 0))} | ${teams.filter((t) => t.ohne >= 0).length}->${teams.filter((t) => t.ohne + mk(t) >= 0).length} | ${r2(verh(false))}->${r2(verh(true))} | ${r1(abst((t) => t.ohne + mk(t)) - abst((t) => t.ohne))} | ${r1(mittel(sortiert.slice(0, 8).map(mk)))}/${r1(mittel(sortiert.slice(-8).map(mk)))} | ${r1(mittel(teams.filter((t) => t.liga === "liga1").map(f)))}/${r1(mittel(teams.filter((t) => t.liga === "liga2").map(f)))}`,
    );
  }
}
