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
/**
 * ALLE Parameter kommen aus scripts/sponsor-model-params.ts. Dieses Skript war die dritte Quelle
 * der Wahrheit; die Pruefmaschinerie in sponsor-model-proposal.ts sah seine Werte nie.
 */
import {
  TIERS, tierOf, LIGA, FLOOR_ABSOLUT, FLOOR_RARITY, floorAt, RARITY_MULT, RARITY_ORDER,
  RARITY_DRAW, POOL_EVEN_SHARE, TARGET_EV_SHAPE, rel, CLAUSE_S_REPR, CLAUSE_P_REPR,
  clauseBonus, clauseMalus, dist, PROFILES, cardTargets, SEASON_SF, SALARY_SUM_S1, salaryAtRank,
} from "./sponsor-model-params";

export { TIERS, tierOf, LIGA, dist, rel, SEASON_SF };

const FLAT = process.argv.includes("--floor") && process.argv[process.argv.indexOf("--floor") + 1] === "flach";
/** Wahrscheinlichkeit, dass die Klausel erfuellt wird bzw. das Sonderziel gelingt (Design-Schaetzung). */
const P_CLAUSE = CLAUSE_P_REPR, P_GOAL = 0.45;

/** Deterministischer Zufall — reproduzierbar ohne Math.random. */
let seed = 12345;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

const SEASONS = Number(process.argv[process.argv.indexOf("--seasons") + 1]) || 5;
const salaryAt = salaryAtRank;
/**
 * Zielsumme der Liga = Summe der modellierten Gehaelter ueber alle 32 Raenge (linear 87.8 -> 43.7,
 * also 2104). Die gemessene Referenz aus dem echten S1-Save liegt bei ${SALARY_SUM_S1} — die
 * Differenz ist der Fehler der linearen Naeherung des Gehaltsverlaufs, nicht des Modells.
 */
const SALARY_SUM_MODEL = Array.from({ length: 32 }, (_, i) => salaryAt(i + 1)).reduce((a, b) => a + b, 0);

type Team = { id: number; strength: number; cash: number; hist: number[] };
const teams: Team[] = Array.from({ length: 32 }, (_, i) => ({ id: i + 1, strength: i + 1, cash: 0, hist: [] }));

console.log("=".repeat(104));
console.log(`5-SAISON-MODELL — Untergrenze je Rarity ${RARITY_ORDER.map((r) => FLOOR_RARITY[r]).join("/")} (absolut min ${FLOOR_ABSOLUT}${FLAT ? ", FLACH erzwungen" : ""}) · sf ${SEASON_SF.join(" / ")}`);
console.log(`Rarity-Pool ${RARITY_ORDER.map((r) => `${r} ${RARITY_MULT[r]}`).join(" · ")} · Gleichanteil ${(POOL_EVEN_SHARE * 100).toFixed(0)} % · Leiter-Spitze ${TARGET_EV_SHAPE[0]!.toFixed(1)}`);
console.log("=".repeat(104));

let leagueSumAll = 0, salarySumAll = 0, insolvenzen = 0, floorHits = 0, cells = 0;
for (let s = 1; s <= SEASONS; s += 1) {
  const sf = SEASON_SF[(s - 1) % SEASON_SF.length]!;
  // K je Saison loesen, damit der Faktor VOLL in der Liga-Summe ankommt. Fest gesetzt kam er nur zu
  // rund zwei Dritteln durch: die Untergrenze faengt schwache Jahre ab und die Decken begrenzen
  // starke, wodurch 1.25 wie 1.09 wirkte. Die Anhebung trifft alle Stufen gleichmaessig, weil K auf
  // den gesamten Anteil oberhalb der Untergrenze wirkt.
  const targetSum = SALARY_SUM_MODEL * sf;
  // Endraenge: Erwartung = Staerkerang, verrauscht
  const draw = teams.map((t) => ({ t, key: t.strength + (rnd() - 0.5) * 11 }))
    .sort((a, b) => a.key - b.key);
  // Karten EINMAL ziehen, dann K gegen genau diese Ziehung loesen. Zuvor rechnete die Probe mit
  // einer vereinfachten Einheitskarte, waehrend die Auszahlung die echten Ziehungen nutzte — das
  // Boomjahr schoss dadurch ueber (135 % statt 125 %).
  const cards = draw.map(({ t }, idx) => {
    const finalRank = idx + 1, expTier = tierOf(t.strength), finTier = tierOf(finalRank);
    let u = rnd(), rIdx = 0, acc = 0;
    for (let i = 0; i < RARITY_ORDER.length; i += 1) { acc += RARITY_DRAW[RARITY_ORDER[i]!]!; if (u <= acc) { rIdx = i; break; } }
    const rarName = RARITY_ORDER[rIdx]!;
    const prof = PROFILES[Math.floor(rnd() * PROFILES.length)]!;
    const { ladder: ladderTarget, special } = cardTargets(rarName, prof, expTier);
    const w = dist(t.strength);
    const raw = w.reduce((a2, wi, i) => a2 + wi * (LIGA[tierOf(i + 1)]! + rel(expTier - tierOf(i + 1))), 0);
    const clauseMet = rnd() < P_CLAUSE, goalMet = rnd() < P_GOAL;
    const v = LIGA[finTier]! + rel(expTier - finTier) + (ladderTarget - raw)
      + (clauseMet ? clauseBonus(CLAUSE_S_REPR, P_CLAUSE) : -clauseMalus(CLAUSE_S_REPR, P_CLAUSE))
      + (goalMet ? special / P_GOAL : 0);
    return { t, finalRank, expTier, v, fl: FLAT ? FLOOR_ABSOLUT : floorAt(rarName, sf) };
  });
  let KFOR = 1.48 * sf;
  for (let iter = 0; iter < 60; iter += 1) {
    const probe = cards.reduce((a2, c) => a2 + Math.max(c.fl, c.fl + (c.v - c.fl) * KFOR), 0);
    KFOR *= targetSum / probe;
  }
  let seasonSum = 0, seasonSalary = 0;
  cards.forEach((c) => {
    const paid = Math.max(c.fl, c.fl + (c.v - c.fl) * KFOR);
    if (paid === c.fl && c.v < c.fl) floorHits += 1;
    cells += 1;
    const sal = salaryAt(c.finalRank);
    c.t.cash += paid - sal; c.t.hist.push(c.finalRank);
    seasonSum += paid; seasonSalary += sal;
    if (c.t.cash < -40) insolvenzen += 1;
    c.t.strength = Math.max(1, Math.min(32, Math.round(c.t.strength + (c.t.cash > 10 ? -1 : c.t.cash < -10 ? 1 : 0))));
  });
  leagueSumAll += seasonSum; salarySumAll += seasonSalary;
  console.log(`  S${s} (sf ${sf.toFixed(2)}): Σ Sponsoren ${seasonSum.toFixed(0)}  Σ Gehälter ${seasonSalary.toFixed(0)}  Deckung ${(seasonSum/seasonSalary*100).toFixed(0)} %  (Ziel ${(sf*100).toFixed(0)} %)`);
}

console.log(`\n  Über ${SEASONS} Saisons: Deckung ${(leagueSumAll/salarySumAll*100).toFixed(1)} %  ·  Untergrenze gegriffen in ${(floorHits/cells*100).toFixed(1)} % der Fälle  ·  Insolvenzen ${insolvenzen}`);
const sorted = [...teams].sort((a, b) => b.cash - a.cash);
console.log(`\n  Kumulierter Saldo (Sponsor minus Gehalt) nach ${SEASONS} Saisons:`);
console.log(`    bestes Team ${sorted[0]!.cash.toFixed(0)}  ·  Median ${sorted[16]!.cash.toFixed(0)}  ·  schlechtestes ${sorted[31]!.cash.toFixed(0)}`);
console.log(`    Teams im Plus: ${teams.filter((t) => t.cash > 0).length}/32  ·  unter -40 (Insolvenzrisiko): ${teams.filter((t) => t.cash < -40).length}`);
