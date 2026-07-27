/**
 * Auszahlungsbänder je Seltenheit und Tabellenplatz.
 *
 * Zeigt, was ein Team auf einem gegebenen Erwartungsplatz mit einer Karte der jeweiligen Rarity
 * bekommt: Erwartungswert, realistisches Band (schlechtester bis bester Ausgang im erreichbaren
 * Korridor) und die Streuung. Basis ist das Budget-Pool-Modell aus scripts/sponsor-model-proposal.ts;
 * die Rarity setzt die Budgetgroesse, das Verteilungsprofil entscheidet ueber die Form.
 *
 * Aufruf: npx tsx scripts/sponsor-rarity-bands.ts [--profile ausgewogen|spitzenlastig|sockellastig|zielschwer]
 */
/**
 * ALLE Parameter kommen aus scripts/sponsor-model-params.ts. Dieses Skript trug den Satz vorher
 * selbst — und war damit eine von drei Quellen der Wahrheit. Die Pruefmaschinerie in
 * sponsor-model-proposal.ts sah diese Werte nie.
 */
import {
  TIERS, tierOf, LIGA, FLOOR_ABSOLUT, floorAt, RARITY_MULT, RARITY_ORDER, POOL_EVEN_SHARE,
  TARGET_GAMMA, rel, CLAUSE_S_REPR, CLAUSE_P_REPR, clauseBonus, clauseMalus,
  SIGMA, CORRIDOR, dist, PROFILES, profileByName, cardTargets,
} from "./sponsor-model-params";

export { TIERS, tierOf, LIGA, dist };

const argIdx = process.argv.indexOf("--profile");
const PROF_NAME = argIdx >= 0 ? process.argv[argIdx + 1]! : "ausgewogen";
const PROF = profileByName(PROF_NAME);
const CLAUSE_BONUS = clauseBonus(CLAUSE_S_REPR, CLAUSE_P_REPR);
const CLAUSE_MALUS = clauseMalus(CLAUSE_S_REPR, CLAUSE_P_REPR);

console.log("=".repeat(112));
console.log(`AUSZAHLUNGSBÄNDER je Seltenheit und Platz — Profil "${PROF_NAME}", Steilheit ${TARGET_GAMMA}, Untergrenze je Rarity 38/40/42/45 (absolut min ${FLOOR_ABSOLUT})`);
console.log("=".repeat(112));
console.log("Ø = Erwartungswert · Band = schlechtester bis bester realistischer Ausgang · in Klammern die Spannweite\n");
console.log("Platz".padEnd(10) + RARITY_ORDER.map((n) => `${n}`.padStart(26)).join(""));
console.log("".padEnd(10) + RARITY_ORDER.map(() => "Ø     Band".padStart(26)).join(""));

for (let ti = 0; ti < TIERS.length; ti += 1) {
  const e = Math.round((TIERS[ti]!.lo + TIERS[ti]!.hi) / 2);
  const cells = RARITY_ORDER.map((rarity) => {
    const { ladder: ladderTarget, special } = cardTargets(rarity, PROF, ti);
    const FLOOR = floorAt(rarity, 1.0);
    const w = dist(e);
    // cal so, dass der Rangteil im Mittel das Leiterziel trifft (geschlossene Loesung)
    const raw = w.reduce((a, wi, i) => a + wi * (LIGA[tierOf(i + 1)]! + rel(ti - tierOf(i + 1))), 0);
    const cal = ladderTarget - raw;
    const band: number[] = [];
    for (let r = Math.max(1, e - CORRIDOR); r <= Math.min(32, e + CORRIDOR); r += 1) {
      const v = LIGA[tierOf(r)]! + rel(ti - tierOf(r)) + cal;
      band.push(Math.max(FLOOR, v + CLAUSE_BONUS + special));
      band.push(Math.max(FLOOR, v - CLAUSE_MALUS));
    }
    const ev = w.reduce((a, wi, i) => {
      const v = LIGA[tierOf(i + 1)]! + rel(ti - tierOf(i + 1)) + cal;
      return a + wi * (CLAUSE_P_REPR * Math.max(FLOOR, v + CLAUSE_BONUS + special)
                     + (1 - CLAUSE_P_REPR) * Math.max(FLOOR, v - CLAUSE_MALUS));
    }, 0);
    const lo = Math.min(...band), hi = Math.max(...band);
    return `${ev.toFixed(0)}   ${lo.toFixed(0)}–${hi.toFixed(0)} (${(hi - lo).toFixed(0)})`.padStart(26);
  });
  console.log(TIERS[ti]!.label.padEnd(10) + cells.join(""));
}
console.log(`\nHinweis: gerechnet mit der repräsentativen Karte (Kurve 'Linear', Klausel Spannweite ${CLAUSE_S_REPR}, p ${CLAUSE_P_REPR}, sigma ${SIGMA}, Korridor ±${CORRIDOR}).`);
console.log(`Rarity-Multiplikatoren ${RARITY_ORDER.map((r) => `${r} ${RARITY_MULT[r]}`).join(" · ")} · Pool-Gleichanteil ${(POOL_EVEN_SHARE * 100).toFixed(0)} %`);
console.log("Andere Kurven/Klauseln verschieben das Band bei gleichem Erwartungswert — das ist der Sinn der Achsen.");
