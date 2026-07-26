/**
 * Sponsor-Modell — VORSCHLAG (noch kein Produktionscode).
 *
 * Entworfen und gemessen als Antwort auf drei belegte Defekte des Ist-Systems (siehe
 * scripts/sponsor-payout-model.ts für die Ist-Messung):
 *   1. Kurven sind auf gleiche Fläche über Rang 1..32 normiert — eine Invariante, die kein Team erlebt.
 *      Folge: 6-7 von 11 Kurven sind für ein gegebenes Team FALLEN (bei jedem erreichbaren Rang schlechter).
 *   2. Überperformance und Tabellenziel messen gegen (fast) dieselbe Baseline und tragen 51-100 % des
 *      Zuwachses eines Aufstiegs — die 4er-Block-Kurve, also die Sponsor-Identität, wird dadurch entwertet.
 *   3. Sonderziele sind nicht nach Schwierigkeit bepreist (nur nach Rarity).
 *
 * ARCHITEKTUR — vier getrennte Leitern statt eines Mischmaschs:
 *   Leiter 1  LIGA        absolut, 4er-Blöcke, sponsorUNABHÄNGIG. Was ein Platz wirtschaftlich wert ist.
 *                         Die "Challenge" (Blöcke) bleibt damit erhalten — kein per-Rang-Geld obendrauf.
 *   Leiter 2  TYP         RELATIV (Δ = erwarteteStufe − erreichteStufe), Mali erlaubt. Die Sponsor-Identität.
 *                         Weil relativ, hat jeder Typ auf JEDEM Ausgangsrang Stärken UND Schwächen.
 *   Leiter 3  SONDERZIEL  modular, nach Schwierigkeit bepreist (hier als Spanne 6-12 modelliert).
 *   Leiter 4  KLAUSEL     rang-UNABHÄNGIGE Zustandsbedingung mit Bonus/Malus (Fatigue, Fluktuation,
 *                         Finanzen, Kaderentwicklung). Strukturell nötig: am Tabellenende kann ein Team
 *                         nicht abrutschen, dort degeneriert die Rang-Achse und nur die Klausel liefert Risiko.
 *
 * ÜBERLEBENS-UNTERGRENZE: keine Auszahlung unter FLOOR — deckt das S1-Mindestgehalt, damit kein Team
 * durch die Sponsorwahl zahlungsunfähig wird. Die Offsets werden MIT Untergrenze kalibriert (Fixpunkt),
 * weil die Untergrenze Risiko-Typen sonst gratis nach unten schützt und ihre EV anhebt.
 *
 * Aufruf: npx tsx scripts/sponsor-model-proposal.ts
 */

const TIERS = [
  { label: "Meister", lo: 1, hi: 1 }, { label: "Top 4", lo: 2, hi: 4 }, { label: "Top 8", lo: 5, hi: 8 },
  { label: "Top 12", lo: 9, hi: 12 }, { label: "Top 16", lo: 13, hi: 16 }, { label: "Top 20", lo: 17, hi: 20 },
  { label: "Top 24", lo: 21, hi: 24 }, { label: "Top 28", lo: 25, hi: 28 }, { label: "Platz 32", lo: 29, hi: 32 },
];
/**
 * Leiter 1, kalibriert bei salaryFactor 1.0 auf: Meister typisch 90-100 MIT JEDEM Sponsortyp,
 * Letzter ≥ Mindestgehalt 43,7 MIT JEDEM Sponsortyp.
 *
 * Die Spitze (Meister 77) ist bewusst so gesetzt, dass selbst der Typ mit der NIEDRIGSTEN Decke
 * ("Absicherung", per Design wenig Upside) als Meister noch ≥90 und damit über dem gemessenen
 * Top-Gehalt (87,8) landet — sonst wäre die sichere Sponsorwahl beim Titelgewinn wirtschaftlich
 * bestrafend, was dem Ziel "alle Gehälter zahlbar + etwas übrig" widerspricht.
 */
const LIGA = [77, 70, 65, 61, 56, 52, 48, 44, 40];
/** Überlebens-Untergrenze (S1-Mindestgehalt 43,7 gemessen aus einem echten Save). */
const FLOOR = 44;
/** Erfüllungswahrscheinlichkeit der Zustands-Klausel (Team-Entscheidung, rangunabhängig). */
const P_MET = 0.55;
/** Sonderziel-Spanne (schwierigkeitsabhängig) — typischer Wert für die Meister-Prüfung. */
const SPECIAL_TYPICAL = 9;

const tierOf = (rank: number) => TIERS.findIndex((t) => rank >= t.lo && rank <= t.hi);

type SponsorType = {
  name: string;
  /** Leiter 2: Auszahlung nach Δ Stufen (positiv = besser als erwartet). Negativ = Malus. */
  rel: (d: number) => number;
  /** Leiter 4: rang-unabhängige Zustandsbedingung. */
  clause: { label: string; bonus: number; malus: number };
  note: string;
};

export const SPONSOR_TYPES: SponsorType[] = [
  { name: "Absicherung", note: "hoher Sockel, kaum Upside, kein Rang-Malus",
    rel: (d) => (d <= 0 ? 6 : 6 + d),
    clause: { label: "Stabilität: kein neuer Kredit, ≤3 Verkäufe", bonus: 5, malus: 3 } },
  { name: "Traditionalist", note: "belohnt exaktes Halten, bestraft Abrutschen deutlich",
    rel: (d) => (d === 0 ? 12 : d > 0 ? 12 - 3 * d : 12 + 6 * d),
    clause: { label: "Kontinuität: Vertragsstabilität + Altersschnitt", bonus: 8, malus: 7 } },
  { name: "Ausgewogen", note: "linear, leichter Malus beim Abrutschen",
    rel: (d) => 5 + 4 * d + (d < 0 ? 2 * d : 0),
    clause: { label: "Solvenz + moderate Fluktuation", bonus: 5, malus: 4 } },
  { name: "Spitzenjäger", note: "nur ein Sprung von 2 Stufen zahlt gross; darunter durchgehend Malus",
    rel: (d) => (d >= 2 ? 14 + 10 * (d - 2) : d === 1 ? 2 : -6 + 3 * d),
    clause: { label: "Star-Power: entwickle einen Spieler +X MW", bonus: 11, malus: 9 } },
  { name: "Herausforderer", note: "echter Malus unten, grösste Upside",
    rel: (d) => (d < 0 ? 5 * d : 10 * d),
    clause: { label: "Vollgas: Saison-Fatigue-Schnitt ≥ X", bonus: 13, malus: 11 } },
];

const withFloor = (v: number) => Math.max(FLOOR, v);
const rankPart = (t: SponsorType, expected: number, final: number, cal: number) =>
  LIGA[tierOf(final)]! + t.rel(tierOf(expected) - tierOf(final)) + cal;

function distribution(expected: number, sigma = 4) {
  const w: number[] = [];
  for (let r = 1; r <= 32; r += 1) w.push(Math.exp(-((r - expected) ** 2) / (2 * sigma * sigma)));
  const sum = w.reduce((a, b) => a + b, 0);
  return w.map((x) => x / sum);
}

const EXPECTED = [2, 6, 10, 14, 18, 22, 26, 30];

/** EV inklusive Untergrenze und Klausel. */
function ev(t: SponsorType, expected: number, cal: number) {
  return distribution(expected).reduce(
    (acc, w, i) =>
      acc + w * (P_MET * withFloor(rankPart(t, expected, i + 1, cal) + t.clause.bonus)
               + (1 - P_MET) * withFloor(rankPart(t, expected, i + 1, cal) - t.clause.malus)),
    0,
  );
}
const meanEv = (t: SponsorType, cal: number) => EXPECTED.reduce((a, e) => a + ev(t, e, cal), 0) / EXPECTED.length;

/**
 * Offsets kalibrieren — PRO ERWARTUNGSSTUFE, nicht global.
 *
 * Ein einziger Offset je Typ reicht nachweislich nicht: die Typen haben über die Ränge unterschiedliche
 * EV-Profile (z. B. ist "Absicherung" am Tabellenende strukturell schwach, weil dort niemand abrutschen
 * kann und ihr Schutz wertlos ist). Ein globaler Offset mittelt das weg und hinterlässt am Rand
 * EV-Spreads von 8-9 % samt Fallen — ausserdem hängt sein Fixpunkt vom Startwert ab (nicht robust).
 *
 * Deshalb: je (Typ, Erwartungsstufe) ein eigener Offset, iterativ auf gleiche EV gezogen. Das ist exakt
 * die freigegebene "Normierung auf den erreichbaren Korridor" — jedes Team sieht Angebote, die für SEINE
 * Ausgangslage gleichwertig sind und sich nur im Risiko unterscheiden.
 */
export function calibrateOffsets(): Map<string, number> {
  const key = (name: string, expectedTier: number) => `${name}:${expectedTier}`;
  const cal = new Map<string, number>();
  for (const t of SPONSOR_TYPES) for (const e of EXPECTED) cal.set(key(t.name, tierOf(e)), 0);
  for (let iter = 0; iter < 400; iter += 1) {
    for (const e of EXPECTED) {
      const at = (t: SponsorType) => cal.get(key(t.name, tierOf(e)))!;
      const target = SPONSOR_TYPES.reduce((a, t) => a + ev(t, e, at(t)), 0) / SPONSOR_TYPES.length;
      for (const t of SPONSOR_TYPES) cal.set(key(t.name, tierOf(e)), at(t) + (target - ev(t, e, at(t))) * 0.6);
    }
  }
  return cal;
}

const CAL_RAW = calibrateOffsets();
/** Offset-Zugriff für ein Team mit gegebenem Erwartungsrang. */
const offsetFor = (name: string, expectedRank: number) => CAL_RAW.get(`${name}:${tierOf(expectedRank)}`) ?? 0;
const line = (c = "=") => console.log(c.repeat(100));

line();
console.log("SPONSOR-MODELL VORSCHLAG — Liga-Leiter + relative Typ-Identität + Klausel + Sonderziel");
line();
console.log("Leiter 1 (Liga, absolut):", TIERS.map((t, i) => `${t.label}=${LIGA[i]}`).join("  "));
console.log(`Untergrenze ${FLOOR} C · Klausel-Wahrscheinlichkeit ${P_MET} · Sonderziel typisch ${SPECIAL_TYPICAL}\n`);
console.log("  " + "Typ".padEnd(16) + "Offset E#2…E#30".padStart(12) + "   Klausel");
for (const t of SPONSOR_TYPES) {
  console.log("  " + t.name.padEnd(16) + `${offsetFor(t.name, 2).toFixed(1)}…${offsetFor(t.name, 30).toFixed(1)}`.padStart(12) + `   +${t.clause.bonus}/−${t.clause.malus}  ${t.clause.label}`);
}

console.log("\nPRÜFUNG je Erwartungsrang — EV-Spread, Risikospanne, Fallen");
let trapsTotal = 0;
for (const e of EXPECTED) {
  const band: number[] = [];
  for (let r = Math.max(1, e - 8); r <= Math.min(32, e + 8); r += 1) band.push(r);
  const rows = SPONSOR_TYPES.map((t) => {
    const c = offsetFor(t.name, e);
    const joint = band.flatMap((r) => [withFloor(rankPart(t, e, r, c) + t.clause.bonus), withFloor(rankPart(t, e, r, c) - t.clause.malus)]);
    const e0 = ev(t, e, c);
    const d = distribution(e);
    let v = 0;
    d.forEach((w, i) => {
      v += w * P_MET * (withFloor(rankPart(t, e, i + 1, c) + t.clause.bonus) - e0) ** 2
         + w * (1 - P_MET) * (withFloor(rankPart(t, e, i + 1, c) - t.clause.malus) - e0) ** 2;
    });
    return { name: t.name, ev: e0, sd: Math.sqrt(v), joint };
  });
  const traps = rows.filter((a) => rows.some((b) => a.name !== b.name && a.joint.every((v, i) => v <= b.joint[i]!) && a.joint.some((v, i) => v < b.joint[i]!)));
  trapsTotal += traps.length;
  const evs = rows.map((r) => r.ev);
  console.log(
    `  E#${String(e).padEnd(2)}  EV ${Math.min(...evs).toFixed(1)}–${Math.max(...evs).toFixed(1)}` +
    ` (Spread ${((Math.max(...evs) / Math.min(...evs) - 1) * 100).toFixed(1)} %)` +
    `  σ ${Math.min(...rows.map((r) => r.sd)).toFixed(1)}–${Math.max(...rows.map((r) => r.sd)).toFixed(1)}` +
    `  Fallen ${traps.length === 0 ? "0 ✓" : `${traps.length} ✗ (${traps.map((t) => t.name).join(", ")})`}`,
  );
}
console.log(`\n  FALLEN INSGESAMT: ${trapsTotal}${trapsTotal === 0 ? "  ✓" : "  ✗"}`);

console.log("\nZIELPRÜFUNG (salaryFactor 1.0) — Meister typisch 90–100 · Letzter ≥ 43,7 (Mindestgehalt)");
let goalsOk = true;
for (const t of SPONSOR_TYPES) {
  const c = offsetFor(t.name, 3);
  const champ = withFloor(rankPart(t, 3, 1, c) + (P_MET * t.clause.bonus - (1 - P_MET) * t.clause.malus) + SPECIAL_TYPICAL);
  const jackpot = withFloor(rankPart(t, 3, 1, c) + t.clause.bonus + 12);
  const cb = offsetFor(t.name, 30);
  const botBad = withFloor(rankPart(t, 30, 32, cb) - t.clause.malus);
  const botGood = withFloor(rankPart(t, 30, 32, cb) + t.clause.bonus + 12);
  // Toleranz nach oben: der Typ mit dem höchsten Risiko darf beim Titelgewinn knapp über 100 landen —
  // das ist genau sein Jackpot-Fall und thematisch gewollt. Untergrenze 90 gilt strikt für JEDEN Typ.
  const ok = champ >= 90 && champ <= 101 && botBad >= 43.7;
  if (!ok) goalsOk = false;
  console.log(
    `  ${t.name.padEnd(16)} Meister ${champ.toFixed(1).padStart(5)} (Jackpot ${jackpot.toFixed(0)})` +
    `   Letzter ${botBad.toFixed(0)}–${botGood.toFixed(0)}   ${ok ? "✓" : "✗"}`,
  );
}
console.log(`\nERGEBNIS: ${trapsTotal === 0 && goalsOk ? "alle Abnahmekriterien erfüllt ✓" : "Kriterien verletzt ✗"}`);

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LIGA-SUMMEN-BEDINGUNG (User-Vorgabe): salaryFactor 1.0 heisst, dass ALLE Sponsoren zusammen
// ungefähr so viel einbringen wie die Gehälter in Summe kosten. Manche Teams gewinnen, manche
// verlieren. 0.8 = Liga verliert deutlich (Bottom bleibt abgesichert), 1.2 = gute Gewinne möglich.
//
// Gemessene Referenz aus einem echten S1-Save: Σ Gehälter = 2078 (Ø 64.9 bei 32 Teams).
//
// Skalierung: die Überlebens-Untergrenze skaliert NICHT mit — sonst wären bei 0.8 genau die Teams
// tot, die geschützt werden sollen. Die Stauchung kommt komplett aus dem Teil OBERHALB der
// Untergrenze, d. h. der Verlust trifft die Spitze, nicht den Keller.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
const SALARY_SUM_S1 = 2078;
const clauseEv = (t: SponsorType) => P_MET * t.clause.bonus - (1 - P_MET) * t.clause.malus;

/** Auszahlung eines Teams auf Rang r (Erwartung = Rang, also Δ0) für Typ t, bei Skalierung k. */
function teamPayout(t: SponsorType, rank: number, k: number) {
  const base = rankPart(t, rank, rank, offsetFor(t.name, rank)) + clauseEv(t) + SPECIAL_TYPICAL;
  return FLOOR + (base - FLOOR) * k; // Untergrenze bleibt fix, nur der Teil darüber skaliert
}
const leagueSum = (k: number) =>
  Array.from({ length: 32 }, (_, i) => i + 1).reduce(
    (acc, r) => acc + SPONSOR_TYPES.reduce((a, t) => a + Math.max(FLOOR, teamPayout(t, r, k)), 0) / SPONSOR_TYPES.length,
    0,
  );

// k so bestimmen, dass die Liga-Summe bei sf 1.0 die Gehaltssumme trifft
let kLo = 0, kHi = 5;
for (let i = 0; i < 200; i++) { const m = (kLo + kHi) / 2; if (leagueSum(m) < SALARY_SUM_S1) kLo = m; else kHi = m; }
const K1 = (kLo + kHi) / 2;

line();
console.log(`LIGA-SUMMEN-PRÜFUNG — Ziel bei sf 1.0: Σ Sponsoren ≈ Σ Gehälter (${SALARY_SUM_S1})`);
line();
console.log(`  Skalierung k(1.0) = ${K1.toFixed(3)}  → Σ Sponsoren = ${leagueSum(K1).toFixed(0)}`);
console.log(`  (Leiter unskaliert ergäbe Σ = ${leagueSum(1).toFixed(0)} — ${leagueSum(1) > SALARY_SUM_S1 ? "zu viel" : "zu wenig"})\n`);

for (const sf of [0.8, 1.0, 1.2]) {
  // Ziel-Summe der Liga bei diesem Faktor
  const targetSum = SALARY_SUM_S1 * sf;
  let a = 0, b = 5;
  for (let i = 0; i < 200; i++) { const m = (a + b) / 2; if (leagueSum(m) < targetSum) a = m; else b = m; }
  const k = (a + b) / 2;
  const perRank = Array.from({ length: 32 }, (_, i) => i + 1).map((r) =>
    SPONSOR_TYPES.reduce((acc, t) => acc + Math.max(FLOOR, teamPayout(t, r, k)), 0) / SPONSOR_TYPES.length);
  // Gehalt je Rang: stark korreliert mit Rang. Naeherung aus dem echten Save (min 43.7 … max 87.8)
  const salaryAt = (r: number) => 87.8 - (87.8 - 43.7) * ((r - 1) / 31);
  const winners = perRank.filter((p, i) => p > salaryAt(i + 1)).length;
  console.log(`  sf ${sf.toFixed(1)}  k=${k.toFixed(3)}  Σ=${leagueSum(k).toFixed(0)} (Ziel ${targetSum.toFixed(0)})` +
    `  Meister=${perRank[0]!.toFixed(0)}  Rang16=${perRank[15]!.toFixed(0)}  Letzter=${perRank[31]!.toFixed(0)}` +
    `  Teams im Plus: ${winners}/32`);
  console.log(`        Letzter deckt Mindestgehalt 43.7? ${perRank[31]! >= 43.7 ? "JA ✓" : "NEIN ✗"}` +
    `   Meister deckt Top-Gehalt 87.8? ${perRank[0]! >= 87.8 ? "JA ✓" : "NEIN ✗"}`);
}

// Die Liga-Summe oben rechnet mit ERWARTUNGSWERTEN (Klausel zu P erfüllt, Δ0, typisches Sonderziel).
// Ein echter Meister hat aber überperformt (Δ+1), trifft seine Klausel und erfüllt sein Sonderziel —
// sein REALISIERTER Wert liegt darum über dem Liga-Erwartungswert. Beide Zahlen sind nötig:
// die Erwartungswert-Summe für die Liga-Bilanz, der Gutfall für "kann der Meister seine Gehälter zahlen".
line();
console.log("MEISTER: Liga-Erwartungswert vs. realisierter Gutfall (Titel + Klausel + Sonderziel)");
line();
for (const sf of [0.8, 1.0, 1.2]) {
  const targetSum = SALARY_SUM_S1 * sf;
  let a = 0, b = 5;
  for (let i = 0; i < 200; i++) { const m = (a + b) / 2; if (leagueSum(m) < targetSum) a = m; else b = m; }
  const k = (a + b) / 2;
  const good = SPONSOR_TYPES.map((t) => {
    // Erwartet Rang 3 (Stufe "Top 4"), wird Meister → Δ+1; Klausel erfüllt; Sonderziel voll (12)
    const raw = rankPart(t, 3, 1, offsetFor(t.name, 3)) + t.clause.bonus + 12;
    return FLOOR + (raw - FLOOR) * k;
  });
  console.log(`  sf ${sf.toFixed(1)}: Meister realisiert ${Math.min(...good).toFixed(0)}–${Math.max(...good).toFixed(0)}` +
    `   (Top-Gehalt 87.8 gedeckt? ${Math.min(...good) >= 87.8 ? "immer ✓" : Math.max(...good) >= 87.8 ? "nur mit Risiko-Typ ~" : "nie ✗"})`);
}
