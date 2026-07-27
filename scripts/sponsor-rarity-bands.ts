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
export const TIERS = [
  { label: "Meister",  lo: 1,  hi: 1  }, { label: "Top 4",   lo: 2,  hi: 4  }, { label: "Top 8",   lo: 5,  hi: 8  },
  { label: "Top 12",   lo: 9,  hi: 12 }, { label: "Top 16",  lo: 13, hi: 16 }, { label: "Top 20",  lo: 17, hi: 20 },
  { label: "Top 24",   lo: 21, hi: 24 }, { label: "Top 28",  lo: 25, hi: 28 }, { label: "Platz 32", lo: 29, hi: 32 },
];
export const tierOf = (r: number) => TIERS.findIndex((t) => r >= t.lo && r <= t.hi);
export const LIGA = [72, 67, 63, 59, 55, 51, 47, 43, 39];
/**
 * Untergrenze 35 statt 44 — und ausdruecklich KEIN harter Deckel.
 * 35 ist der Ansatz fuer den gewoehnlichen Fall in einer schwachen Saison (sf 0.8). Mit 44 klemmte
 * fast jedes Band am unteren Ende fest; im Extremfall (gewoehnlich/sockellastig/Platz 32) kollabierte
 * die Karte auf 44-44 mit Spannweite 0 — dort wirkte weder Kurve noch Klausel noch Sonderziel.
 */
export const FLOOR = Number(process.env.OLY_SPONSOR_FLOOR ?? 35);
/**
 * Anteil des Rarity-Pools, der GLEICHMAESSIG auf alle Stufen geht, bevor das Profil den Rest formt.
 * Ohne ihn gehen Keller-Teams bei einem spitzenlastigen Profil voellig leer aus (gemessen: Platz 32
 * bekam 48/49/50/51 ueber alle vier Rarities — eine legendaere Karte war dort so viel wert wie eine
 * gewoehnliche). Eine hoehere Seltenheit soll auf JEDEM Platz spuerbar sein, nur unterschiedlich stark.
 */
export const POOL_EVEN_SHARE = Number(process.env.OLY_SPONSOR_EVEN ?? 0.5);
const GAMMA = Number(process.env.OLY_SPONSOR_GAMMA ?? 1.7);
const BASE = [76.0, 73.6, 71.6, 67.9, 63.8, 59.9, 56.7, 54.1, 53.0];
const MEAN = BASE.reduce((a, b) => a + b, 0) / BASE.length;
export const SHAPE = BASE.map((v) => MEAN + (v - MEAN) * GAMMA);
export const RARITY: Array<[string, number]> = [["gewöhnlich", 0.85], ["magisch", 1.0], ["selten", 1.15], ["legendär", 1.35]];
const BASE_SPECIAL = 0.25;

export const PROFILES: Record<string, { specialShare: number; w: number[] }> = {
  ausgewogen:    { specialShare: 0.25, w: [.11, .11, .11, .11, .11, .11, .11, .11, .12] },
  spitzenlastig: { specialShare: 0.15, w: [.28, .24, .18, .12, .08, .05, .03, .02, .00] },
  sockellastig:  { specialShare: 0.15, w: [.00, .02, .03, .05, .08, .12, .18, .24, .28] },
  zielschwer:    { specialShare: 0.70, w: [.11, .11, .11, .11, .11, .11, .11, .11, .12] },
};
const argIdx = process.argv.indexOf("--profile");
const PROF_NAME = argIdx >= 0 ? process.argv[argIdx + 1]! : "ausgewogen";
const PROF = PROFILES[PROF_NAME] ?? PROFILES.ausgewogen!;

/** Repraesentative Kurve (Linear) und Klausel (mittlere Spannweite) fuer die Bandbreite. */
/** Repraesentative Kurve. Der Aufwaerts-Ast von 4 auf 2.5 zurueckgenommen: die Decken lagen je
 *  Stufe rund 10 C zu hoch, und sie werden von der Rangleiter getragen, nicht von Klausel oder
 *  Sonderziel (deren Reduktion nahm nur 2-3 C). Kostet Belohnung fuers Klettern — bewusst. */
const rel = (d: number) => 5 + 2.5 * d + (d < 0 ? 2 * d : 0);
/** Repraesentative Klausel-Spannweite: von 18 auf 11 zurueckgenommen — die Decken lagen je Stufe
 *  rund 10 C zu hoch. Der Erwartungswert bleibt davon unberuehrt (Klausel-EV ist 0). */
const CLAUSE_S = 11, CLAUSE_P = 0.5;
export const dist = (e: number, s = 4) => {
  const w: number[] = [];
  for (let r = 1; r <= 32; r += 1) w.push(Math.exp(-((r - e) ** 2) / (2 * s * s)));
  const t = w.reduce((a, b) => a + b, 0);
  return w.map((x) => x / t);
};

console.log("=".repeat(112));
console.log(`AUSZAHLUNGSBÄNDER je Seltenheit und Platz — Profil "${PROF_NAME}", Steilheit ${GAMMA}, Untergrenze ${FLOOR}`);
console.log("=".repeat(112));
console.log("Ø = Erwartungswert · Band = schlechtester bis bester realistischer Ausgang · in Klammern die Spannweite\n");
console.log("Platz".padEnd(10) + RARITY.map(([n]) => `${n}`.padStart(26)).join(""));
console.log("".padEnd(10) + RARITY.map(() => "Ø     Band".padStart(26)).join(""));

for (let ti = 0; ti < TIERS.length; ti += 1) {
  const e = Math.round((TIERS[ti]!.lo + TIERS[ti]!.hi) / 2);
  const cells = RARITY.map(([, mult]) => {
    const pool = (mult - 1) * MEAN * TIERS.length;
    const shaped = pool * (1 - PROF.specialShare);
    const evenPart = (shaped * POOL_EVEN_SHARE) / TIERS.length;
    const profilePart = shaped * (1 - POOL_EVEN_SHARE) * PROF.w[ti]!;
    const ladderTarget = SHAPE[ti]! * (1 - BASE_SPECIAL) + evenPart + profilePart;
    const special = SHAPE[ti]! * BASE_SPECIAL + (pool * PROF.specialShare) / TIERS.length;
    const w = dist(e);
    // cal so, dass der Rangteil im Mittel das Leiterziel trifft (geschlossen, wie von Fable vorgeschlagen)
    const raw = w.reduce((a, wi, i) => a + wi * (LIGA[tierOf(i + 1)]! + rel(ti - tierOf(i + 1))), 0);
    const cal = ladderTarget - raw;
    const band: number[] = [];
    for (let r = Math.max(1, e - 8); r <= Math.min(32, e + 8); r += 1) {
      const v = LIGA[tierOf(r)]! + rel(ti - tierOf(r)) + cal;
      band.push(Math.max(FLOOR, v + CLAUSE_S * (1 - CLAUSE_P) + special));
      band.push(Math.max(FLOOR, v - CLAUSE_S * CLAUSE_P));
    }
    const ev = w.reduce((a, wi, i) => {
      const v = LIGA[tierOf(i + 1)]! + rel(ti - tierOf(i + 1)) + cal;
      return a + wi * (CLAUSE_P * Math.max(FLOOR, v + CLAUSE_S * (1 - CLAUSE_P) + special)
                     + (1 - CLAUSE_P) * Math.max(FLOOR, v - CLAUSE_S * CLAUSE_P));
    }, 0);
    const lo = Math.min(...band), hi = Math.max(...band);
    return `${ev.toFixed(0)}   ${lo.toFixed(0)}–${hi.toFixed(0)} (${(hi - lo).toFixed(0)})`.padStart(26);
  });
  console.log(TIERS[ti]!.label.padEnd(10) + cells.join(""));
}
console.log("\nHinweis: gerechnet mit einer repräsentativen Karte (Kurve 'Linear', Klausel mit Spannweite 18, p 0.5).");
console.log("Andere Kurven/Klauseln verschieben das Band bei gleichem Erwartungswert — das ist der Sinn der Achsen.");
