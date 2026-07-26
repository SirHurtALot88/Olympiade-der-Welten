/**
 * Sonderziel-Bepreisung nach Schwierigkeit — Entwurf + Durchrechnung (kein Produktionscode).
 *
 * IST-ZUSTAND (gemessen in scripts/sponsor-payout-model.ts): `specialCash` haengt AUSSCHLIESSLICH
 * an der Rarity. Alle 25 Bonus- und 6 Golden-Ziele zahlen bei gleicher Rarity denselben Betrag —
 * ein 22-%-Ziel bringt exakt so viel wie ein 65-%-Ziel. Es gibt keine Schwierigkeits-Bepreisung.
 *
 * VORSCHLAG: Auszahlung = ZielEV / Erfolgswahrscheinlichkeit, gedeckelt. Damit hat jedes Ziel
 * dieselbe EV und unterscheidet sich nur im Risiko — dasselbe Prinzip wie bei den Kurven und
 * Klauseln in scripts/sponsor-model-proposal.ts.
 *
 * Zwei Nebenwirkungen, bewusst in Kauf genommen:
 *  - Der Deckel (4x) drueckt die EV der schwersten Ziele auf 3.6-4.8 statt 6.0. Ohne Deckel zahlte
 *    ein 15-%-Ziel bei magisch 40 C statt 24 — der Tail wuerde die Oekonomie dominieren. Harte
 *    Ziele sind damit leicht schlechterer Erwartungswert, dafuer echte Jackpots.
 *  - Das Wahrscheinlichkeitsband (0.15-0.72) filtert automatisch: was fuer eine Staerkeklasse
 *    trivial oder unmoeglich ist, wird ihr gar nicht erst angeboten. Genau das fehlt heute, wo
 *    "cellar_escape" auch einem Top-Team angeboten werden kann.
 *
 * Die Wahrscheinlichkeiten sind DESIGN-SCHAETZUNGEN und muessen in einem Long-Run gemessen und
 * nachgezogen werden — sie sind der groesste ungemessene Parameter dieses Entwurfs.
 *
 * Aufruf: npx tsx scripts/sponsor-objective-pricing.ts
 */
export type Tier = "elite" | "stark" | "mittel" | "schwach" | "aufbau";
export const TIERS: Tier[] = ["elite", "stark", "mittel", "schwach", "aufbau"];

/** Geschaetzte Erfolgswahrscheinlichkeit je Ziel und Staerkeklasse (Design-Schaetzung, zu messen). */
export const OBJECTIVES: Array<{ key: string; p: Record<Tier, number>; note: string }> = [
  { key: "underdog_story",        p: { elite: 0.00, stark: 0.00, mittel: 0.30, schwach: 0.22, aufbau: 0.15 }, note: "Rang trotz kleinem Kaderwert" },
  { key: "cellar_escape",         p: { elite: 0.00, stark: 0.00, mittel: 0.00, schwach: 0.55, aufbau: 0.40 }, note: "Bottom-N verlassen" },
  { key: "giant_killer",          p: { elite: 0.00, stark: 0.00, mittel: 0.35, schwach: 0.28, aufbau: 0.22 }, note: "Top-4 schlagen" },
  { key: "budget_overachiever",   p: { elite: 0.00, stark: 0.00, mittel: 0.40, schwach: 0.35, aufbau: 0.30 }, note: "Rang ueber Etat" },
  { key: "momentum_series",       p: { elite: 0.70, stark: 0.60, mittel: 0.45, schwach: 0.30, aufbau: 0.22 }, note: "Siegesserie" },
  { key: "discipline_dominance",  p: { elite: 0.55, stark: 0.42, mittel: 0.30, schwach: 0.18, aufbau: 0.12 }, note: "Disziplin-Rang" },
  { key: "axis_ascension",        p: { elite: 0.50, stark: 0.48, mittel: 0.45, schwach: 0.42, aufbau: 0.40 }, note: "Achse in Top-N der Klasse" },
  { key: "market_value_growth",   p: { elite: 0.45, stark: 0.50, mittel: 0.55, schwach: 0.55, aufbau: 0.60 }, note: "Kaderwert-Wachstum" },
  { key: "homegrown_elevation",   p: { elite: 0.40, stark: 0.45, mittel: 0.50, schwach: 0.52, aufbau: 0.58 }, note: "Eigengewaechse entwickeln" },
  { key: "fan_infrastructure",    p: { elite: 0.65, stark: 0.60, mittel: 0.50, schwach: 0.38, aufbau: 0.30 }, note: "Gebaeude ausbauen (Kapital noetig)" },
  { key: "solvency_series",       p: { elite: 0.75, stark: 0.68, mittel: 0.55, schwach: 0.40, aufbau: 0.32 }, note: "durchgehend solvent" },
  { key: "salary_discipline",     p: { elite: 0.35, stark: 0.42, mittel: 0.52, schwach: 0.60, aufbau: 0.65 }, note: "Gehaltssumme unter Schwelle" },
  { key: "debt_payoff",           p: { elite: 0.70, stark: 0.60, mittel: 0.45, schwach: 0.30, aufbau: 0.25 }, note: "Kredit tilgen" },
  { key: "transfer_trader",       p: { elite: 0.50, stark: 0.50, mittel: 0.48, schwach: 0.45, aufbau: 0.42 }, note: "Transfergewinn" },
  { key: "fatigue_management",    p: { elite: 0.45, stark: 0.48, mittel: 0.50, schwach: 0.52, aufbau: 0.55 }, note: "Belastung steuern" },
  { key: "injury_prevention",     p: { elite: 0.42, stark: 0.44, mittel: 0.46, schwach: 0.48, aufbau: 0.50 }, note: "wenige Verletzungen" },
  { key: "contract_stability",    p: { elite: 0.55, stark: 0.55, mittel: 0.52, schwach: 0.45, aufbau: 0.40 }, note: "Vertraege halten" },
  { key: "captain_era",           p: { elite: 0.60, stark: 0.58, mittel: 0.55, schwach: 0.52, aufbau: 0.50 }, note: "Kapitaen halten" },
  { key: "beliebtheit_climb",     p: { elite: 0.50, stark: 0.48, mittel: 0.45, schwach: 0.40, aufbau: 0.35 }, note: "Beliebtheit steigern" },
  { key: "roster_diversity",      p: { elite: 0.50, stark: 0.50, mittel: 0.50, schwach: 0.48, aufbau: 0.45 }, note: "Kaderbreite" },
  { key: "golden_title_shock",    p: { elite: 0.20, stark: 0.12, mittel: 0.05, schwach: 0.00, aufbau: 0.00 }, note: "GOLDEN: Titel als Aussenseiter" },
  { key: "golden_talent_forge",   p: { elite: 0.25, stark: 0.28, mittel: 0.30, schwach: 0.30, aufbau: 0.32 }, note: "GOLDEN: Talentschmiede" },
];

/** Zielwert der EV je Sonderziel-Slot, nach Rarity. */
export const SLOT_EV: Record<string, number> = { "gewöhnlich": 4, "magisch": 6, "selten": 8, "legendär": 10 };
export const SLOTS: Record<string, number> = { "gewöhnlich": 1, "magisch": 2, "selten": 2, "legendär": 3 };
/** Nur Ziele in diesem Wahrscheinlichkeitsband anbieten: darueber trivial, darunter Frust. */
export const P_MIN = 0.15;
export const P_MAX = 0.72;
/** Auszahlung = ZielEV / p, gedeckelt — sonst explodiert der Tail bei sehr kleinem p. */
export const REWARD_CAP = 4.0;
export const price = (evTarget: number, p: number) => evTarget * Math.min(REWARD_CAP, 1 / Math.max(p, P_MIN));

console.log("=".repeat(100));
console.log("SONDERZIEL-BEPREISUNG — Auszahlung = ZielEV / Erfolgswahrscheinlichkeit (gedeckelt)");
console.log("=".repeat(100));
console.log(`Band ${P_MIN}–${P_MAX}  ·  Deckel ${REWARD_CAP}x  ·  Slot-EV ${JSON.stringify(SLOT_EV)}`);

for (const rarity of ["magisch", "legendär"]) {
  console.log(`\n── Rarity ${rarity} (EV/Slot ${SLOT_EV[rarity]}, ${SLOTS[rarity]} Slots) ──`);
  console.log("  " + "Ziel".padEnd(24) + TIERS.map((t) => t.padStart(11)).join(""));
  for (const o of OBJECTIVES) {
    const cells = TIERS.map((t) => {
      const p = o.p[t];
      if (p < P_MIN || p > P_MAX) return "—".padStart(11);
      return `${price(SLOT_EV[rarity]!, p).toFixed(1)} @${(p * 100).toFixed(0)}%`.padStart(11);
    });
    console.log("  " + o.key.padEnd(24) + cells.join(""));
  }
}

console.log("\n" + "=".repeat(100));
console.log("PRÜFUNG");
console.log("=".repeat(100));
for (const t of TIERS) {
  const off = OBJECTIVES.filter((o) => o.p[t] >= P_MIN && o.p[t] <= P_MAX);
  const rewards = off.map((o) => price(SLOT_EV["magisch"]!, o.p[t]));
  const evs = off.map((o) => price(SLOT_EV["magisch"]!, o.p[t]) * o.p[t]);
  console.log(`  ${t.padEnd(9)} angeboten ${String(off.length).padStart(2)}/${OBJECTIVES.length}` +
    `   Auszahlung ${Math.min(...rewards).toFixed(1)}–${Math.max(...rewards).toFixed(1)}` +
    `   EV je Ziel ${Math.min(...evs).toFixed(1)}–${Math.max(...evs).toFixed(1)}`);
}
console.log("\n  Ist-System zum Vergleich: ALLE Ziele zahlen bei magisch pauschal 6.1 — unabhaengig");
console.log("  von Ziel und Team. Ein 22-%-Ziel bringt dort exakt so viel wie ein 65-%-Ziel.");
