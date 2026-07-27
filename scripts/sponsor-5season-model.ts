/**
 * Theoretischer 5-Saison-Lauf des Sponsormodells — mit GESTAFFELTER Untergrenze.
 *
 * Die Untergrenze war bisher absolut (35). Folge: bei den mittleren Stufen lag der Erwartungswert
 * (43-56) so nah am Boden, dass die Baender dort abgeschnitten wurden — Spannweite von der
 * Untergrenze bestimmt statt von der Kurve. Jetzt steigt der Boden zum Tabellenende hin: das
 * Kellerteam braucht den Schutz, das Mittelfeldteam hat Substanz zum Abfedern und bekommt dafuer
 * Luft nach unten.
 *
 * Simuliert 32 Teams ueber 5 Saisons: Rangbewegung um die Teamstaerke, jede Saison neue Karten,
 * Auszahlung am Saisonende. Prueft Zahlungsfaehigkeit, Liga-Bilanz und die Schere ueber die Zeit.
 *
 * Aufruf: npx tsx scripts/sponsor-5season-model.ts [--seasons 5] [--floor gestaffelt|flach]
 */
const TIERS = [[1,1],[2,4],[5,8],[9,12],[13,16],[17,20],[21,24],[25,28],[29,32]] as const;
const LABEL = ["Meister","Top 4","Top 8","Top 12","Top 16","Top 20","Top 24","Top 28","Platz 32"];
/** Rang auf 1..32 klemmen und runden — gebrochene Staerkeraenge lieferten sonst tierOf = -1
 *  und damit NaN in der ganzen Bilanz ab Saison 2. */
const tierOf = (r: number) => {
  const c = Math.max(1, Math.min(32, Math.round(r)));
  return TIERS.findIndex(([lo, hi]) => c >= lo && c <= hi);
};
const LIGA = [72, 67, 63, 59, 55, 51, 47, 43, 39];
/** GESTAFFELT: steigt zum Tabellenende. Flach = alter Zustand, zum Vergleich. */
const FLOOR_TIER = [28, 28, 28, 29, 30, 31, 32, 34, 35];
const FLAT = process.argv.includes("--floor") && process.argv[process.argv.indexOf("--floor") + 1] === "flach";
const floorFor = (tier: number) => (FLAT ? 35 : FLOOR_TIER[tier]!);

const BASE = [76.0, 73.6, 71.6, 67.9, 63.8, 59.9, 56.7, 54.1, 53.0];
const MEAN = BASE.reduce((a, b) => a + b, 0) / BASE.length;
const SHAPE = BASE.map((v) => MEAN + (v - MEAN) * 1.7);
const RARITY: Array<[string, number, number]> = [["gewöhnlich",0.85,0.30],["magisch",1.0,0.47],["selten",1.15,0.18],["legendär",1.35,0.05]];
const BASE_SPECIAL = 0.25, POOL_EVEN = 0.5;
const rel = (d: number) => (d > 0 ? 5 + 2.5*d - 0.9*d*d : 5 + 2.8*d);
const PROFILES = [
  { n: "ausgewogen",    sp: 0.25, w: [.11,.11,.11,.11,.11,.11,.11,.11,.12] },
  { n: "spitzenlastig", sp: 0.15, w: [.28,.24,.18,.12,.08,.05,.03,.02,.00] },
  { n: "sockellastig",  sp: 0.15, w: [.00,.02,.03,.05,.08,.12,.18,.24,.28] },
  { n: "zielschwer",    sp: 0.70, w: [.11,.11,.11,.11,.11,.11,.11,.11,.12] },
];
const dist = (e: number, s = 5.5) => {
  const w: number[] = [];
  for (let r = 1; r <= 32; r += 1) w.push(Math.exp(-((r - e) ** 2) / (2 * s * s)));
  const t = w.reduce((a, b) => a + b, 0);
  return w.map((x) => x / t);
};
/** Deterministischer Zufall — reproduzierbar ohne Math.random. */
let seed = 12345;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

const SEASONS = Number(process.argv[process.argv.indexOf("--seasons") + 1]) || 5;
const salaryAt = (r: number) => 87.8 - (87.8 - 43.7) * ((r - 1) / 31);

type Team = { id: number; strength: number; cash: number; hist: number[] };
const teams: Team[] = Array.from({ length: 32 }, (_, i) => ({ id: i + 1, strength: i + 1, cash: 0, hist: [] }));

console.log("=".repeat(104));
console.log(`5-SAISON-MODELL — Untergrenze ${FLAT ? "flach 35" : "gestaffelt " + FLOOR_TIER.join("/")}`);
console.log("=".repeat(104));

let leagueSumAll = 0, salarySumAll = 0, insolvenzen = 0, floorHits = 0, cells = 0;
for (let s = 1; s <= SEASONS; s += 1) {
  // Endraenge: Erwartung = Staerkerang, verrauscht
  const draw = teams.map((t) => ({ t, key: t.strength + (rnd() - 0.5) * 11 }))
    .sort((a, b) => a.key - b.key);
  let seasonSum = 0, seasonSalary = 0;
  draw.forEach(({ t }, idx) => {
    const finalRank = idx + 1, expTier = tierOf(t.strength), finTier = tierOf(finalRank);
    // Karte ziehen
    let u = rnd(), rIdx = 0, acc = 0;
    for (let i = 0; i < RARITY.length; i += 1) { acc += RARITY[i]![2]; if (u <= acc) { rIdx = i; break; } }
    const [, mult] = RARITY[rIdx]!;
    const prof = PROFILES[Math.floor(rnd() * PROFILES.length)]!;
    const pool = (mult - 1) * MEAN * 9;
    const shaped = pool * (1 - prof.sp);
    const ladderTarget = SHAPE[expTier]! * (1 - BASE_SPECIAL) + (shaped * POOL_EVEN) / 9 + shaped * (1 - POOL_EVEN) * prof.w[expTier]!;
    const special = SHAPE[expTier]! * BASE_SPECIAL + (pool * prof.sp) / 9;
    const w = dist(t.strength);
    const raw = w.reduce((a, wi, i) => a + wi * (LIGA[tierOf(i + 1)]! + rel(expTier - tierOf(i + 1))), 0);
    const cal = ladderTarget - raw;
    const clauseMet = rnd() < 0.5, goalMet = rnd() < 0.45;
    const v = LIGA[finTier]! + rel(expTier - finTier) + cal + (clauseMet ? 5.5 : -5.5) + (goalMet ? special : 0);
    const fl = floorFor(expTier);
    const K = Number(process.env.OLY_K ?? 1.48); // Liga-Skalierung: bindet die Summe an die Gehaltssumme
    const paid = Math.max(fl, fl + (v - fl) * K);
    if (paid === fl && v < fl) floorHits += 1;
    cells += 1;
    const sal = salaryAt(finalRank);
    t.cash += paid - sal; t.hist.push(finalRank);
    seasonSum += paid; seasonSalary += sal;
    if (t.cash < -40) insolvenzen += 1;
    // Staerke folgt dem Geld leicht nach
    t.strength = Math.max(1, Math.min(32, Math.round(t.strength + (t.cash > 10 ? -1 : t.cash < -10 ? 1 : 0))));
  });
  leagueSumAll += seasonSum; salarySumAll += seasonSalary;
  console.log(`  S${s}: Σ Sponsoren ${seasonSum.toFixed(0)}  Σ Gehälter ${seasonSalary.toFixed(0)}  Deckung ${(seasonSum/seasonSalary*100).toFixed(0)} %`);
}

console.log(`\n  Über ${SEASONS} Saisons: Deckung ${(leagueSumAll/salarySumAll*100).toFixed(1)} %  ·  Untergrenze gegriffen in ${(floorHits/cells*100).toFixed(1)} % der Fälle  ·  Insolvenzen ${insolvenzen}`);
const sorted = [...teams].sort((a, b) => b.cash - a.cash);
console.log(`\n  Kumulierter Saldo (Sponsor minus Gehalt) nach ${SEASONS} Saisons:`);
console.log(`    bestes Team ${sorted[0]!.cash.toFixed(0)}  ·  Median ${sorted[16]!.cash.toFixed(0)}  ·  schlechtestes ${sorted[31]!.cash.toFixed(0)}`);
console.log(`    Teams im Plus: ${teams.filter((t) => t.cash > 0).length}/32  ·  unter -40 (Insolvenzrisiko): ${teams.filter((t) => t.cash < -40).length}`);
