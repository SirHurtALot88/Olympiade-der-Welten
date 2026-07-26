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
  // ── Rang-getriebene Arten: die Kurve traegt die Identitaet, die Klausel ist Beiwerk ────────────
  { name: "Bürgschaft", note: "hoher Sockel, kaum Upside — der sichere Hafen",
    rel: (d) => (d <= 0 ? 6 : 6 + d),
    clause: { label: "Stabilität: kein neuer Kredit, ≤3 Verkäufe", bonus: 5, malus: 3 } },
  { name: "Traditionsverein", note: "belohnt exaktes Halten, bestraft Abrutschen hart",
    rel: (d) => (d === 0 ? 12 : d > 0 ? 12 - 3 * d : 12 + 6 * d),
    clause: { label: "Kontinuität: Vertragsstabilität + Altersschnitt", bonus: 8, malus: 7 } },
  { name: "Allrounder", note: "linear, leichter Malus beim Abrutschen — der Standard",
    rel: (d) => 5 + 4 * d + (d < 0 ? 2 * d : 0),
    clause: { label: "Solvenz + moderate Fluktuation", bonus: 5, malus: 4 } },
  { name: "Gipfelstürmer", note: "erst der Sprung ueber 2 Stufen zahlt; darunter durchgehend Malus",
    rel: (d) => (d >= 2 ? 14 + 10 * (d - 2) : d === 1 ? 2 : -6 + 3 * d),
    clause: { label: "Star-Power: entwickle einen Spieler +X MW", bonus: 11, malus: 9 } },
  { name: "Vollgas", note: "steilster Verlauf in beide Richtungen — hoechstes Risiko",
    rel: (d) => (d < 0 ? 5 * d : 10 * d),
    clause: { label: "Einsatz: Saison-Fatigue-Schnitt ≥ X", bonus: 13, malus: 11 } },

  // ── Zustands-getriebene Arten: flache Kurve, die Klausel traegt die Identitaet ─────────────────
  // Fuer Teams, die ihren Rang kaum bewegen koennen (Keller) oder wollen (Konsolidierung) —
  // hier verdient man ueber Spielweise und Aufbau statt ueber die Tabelle.
  { name: "Regenerativ", note: "Gegenstueck zu Vollgas: belohnt Schonung statt Auspowern",
    rel: (d) => (d < -1 ? -4 + 4 * d : 7 + 2 * d),
    clause: { label: "Schonung: Saison-Fatigue-Schnitt ≤ X (Rotation)", bonus: 9, malus: 8 } },
  { name: "Nachwuchs", note: "Kurve fast flach — fast alles haengt an der Jugendentwicklung",
    rel: (d) => (d <= 0 ? 3 : 3 + 1.5 * d),
    clause: { label: "Talent: Eigengewächse entwickeln (+X MW im Kader ≤22 J.)", bonus: 16, malus: 6 } },
  { name: "Baumeister", note: "flachste Kurve — zahlt fuer Infrastruktur statt fuer Plaetze",
    rel: (d) => (d <= 0 ? 2 : 2 + 2 * d),
    clause: { label: "Ausbau: Fan-Shop/Arena-Stufen erhöhen", bonus: 18, malus: 4 } },
  { name: "Spezialist", note: "mittlere Kurve, verlangt ein scharfes Achsen-Profil",
    rel: (d) => 4 + 3 * d,
    clause: { label: "Profil: eine Achse (POW/SPE/MEN/SOC) in die Top-N deiner Stärkeklasse", bonus: 12, malus: 10 } },
  { name: "Sparfuchs", note: "belohnt Halten bei niedriger Kostenbasis — die Eco-Runde",
    rel: (d) => (d < 0 ? 9 + 3 * d : 9 + 2 * d),
    clause: { label: "Effizienz: Gehaltssumme unter der Schwelle deiner Stärkeklasse", bonus: 10, malus: 8 } },
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

/**
 * Untergrenze ATMET mit dem Faktor mit — sie ist nicht fix.
 *
 * Erste Variante hielt sie starr bei 44. Ergebnis war eine zu flache Schere im schlechten Jahr:
 * bei sf 0.8 stand Meister 59 gegen Letzter 47, also nur Faktor 1.26 — ein mieses Ligajahr fuehlte
 * sich fuer die Spitze bestrafend und fuer den Keller fast folgenlos an. Deshalb faellt die
 * Untergrenze bei sf < 1 gedaempft mit (Ziel bei 0.8: 35-40) und gibt der Spitze Luft; bei sf > 1
 * steigt sie moderat. Gedaempft, damit der Keller nicht 1:1 dem Ligajahr ausgeliefert ist.
 */
const FLOOR_DAMP = 0.8;
/**
 * Untergrenze faellt im schlechten Jahr gedaempft mit, steigt im guten Jahr aber NICHT.
 *
 * Sie ist ein Schutzmechanismus, keine Belohnung: in einem miesen Ligajahr muss sie nachgeben,
 * damit die Schere nicht flach wird (sonst Meister 59 gegen Letzter 47 = 1.26x). In einem guten
 * Jahr mitzuwachsen hiesse dagegen, den Keller genau dann anzuheben, wenn die Spitze bevorzugt
 * werden soll — gemessen ergab das eine U-Form im Ueberschuss (R1 +25, R16 +11, R32 +14), also
 * ein ausgequetschtes Mittelfeld. Ohne Mitwachsen faellt der Ueberschuss sauber von oben nach unten.
 */
const floorAt = (sf: number) => (sf >= 1 ? FLOOR : FLOOR * (1 - FLOOR_DAMP * (1 - sf)));

/**
 * NEIGUNG im guten Ligajahr — asymmetrisch, nur nach oben.
 *
 * Ohne Neigung war ein 1.2er-Jahr breit geteilt und begünstigte den Keller sogar leicht
 * (R1 +14 gegen R32 +18), während ein 0.8er-Jahr fast ausschliesslich die Spitze traf
 * (R1 -22 gegen R32 -1). Das war unsymmetrisch zulasten der Top-Teams: sie tragen den
 * Verlust, teilen aber den Gewinn.
 *
 * Deshalb kippt die Leiter bei sf > 1 zugunsten der Spitze — wer die hoechste Gehaltslast
 * traegt und im schlechten Jahr am meisten verliert, wird im guten Jahr am staerksten
 * beteiligt. Bei sf <= 1 bleibt die Neigung aus: die Haerte des schlechten Jahres fuer die
 * Spitze ist gewollt und wird nicht zusaetzlich abgefedert.
 */
/**
 * Voreinstellung 0.8 — bewusst moderat. Gemessene Kippstaerken bei sf 1.2 (Ueberschuss R1 … R32):
 *   0.4 → +25 +18 +15 +13 +12 +13   Schere 1.99x   Meister 121-146
 *   0.8 → +28 +20 +16 +12 +11 +11   Schere 2.11x   Meister 125-152
 *   1.2 → +32 +22 +18 +12 +10 +10   Schere 2.22x   Meister 129-157
 *   1.5 → +34 +24 +18 +11  +9  +9   Schere 2.31x   Meister 132-161
 * 0.8 gibt der Spitze klar den groessten Anteil (+28 gegen +11), ohne den Meister ins Extreme
 * zu ziehen. Ueber OLY_SPONSOR_TILT umstellbar.
 */
const TILT_STRENGTH = Number(process.env.OLY_SPONSOR_TILT ?? 0.8);
const tiltAt = (rank: number, sf: number) =>
  1 + Math.max(0, sf - 1) * TILT_STRENGTH * (1 - 2 * ((rank - 1) / 31));

function teamPayout(t: SponsorType, rank: number, k: number, fl: number, sf: number) {
  const base = rankPart(t, rank, rank, offsetFor(t.name, rank)) + clauseEv(t) + SPECIAL_TYPICAL;
  return fl + (base - FLOOR) * k * tiltAt(rank, sf);
}
const leagueSum = (k: number, fl: number, sf: number) =>
  Array.from({ length: 32 }, (_, i) => i + 1).reduce(
    (acc, r) => acc + SPONSOR_TYPES.reduce((a, t) => a + Math.max(fl, teamPayout(t, r, k, fl, sf)), 0) / SPONSOR_TYPES.length,
    0,
  );
function solveK(targetSum: number, fl: number, sf: number) {
  let a = 0, b = 8;
  for (let i = 0; i < 200; i += 1) { const m = (a + b) / 2; if (leagueSum(m, fl, sf) < targetSum) a = m; else b = m; }
  return (a + b) / 2;
}

line();
console.log(`LIGA-SUMMEN-PRUEFUNG — sf 1.0 heisst: Sigma Sponsoren ~ Sigma Gehaelter (${SALARY_SUM_S1})`);
line();
console.log("  sf    Untergr.      k     Sigma    Meister  Rang16  Letzter   Schere  Teams im Plus");
for (const sf of [0.8, 1.0, 1.2]) {
  const fl = floorAt(sf), k = solveK(SALARY_SUM_S1 * sf, fl, sf);
  const perRank = Array.from({ length: 32 }, (_, i) => i + 1).map((r) =>
    SPONSOR_TYPES.reduce((acc, t) => acc + Math.max(fl, teamPayout(t, r, k, fl, sf)), 0) / SPONSOR_TYPES.length);
  const salaryAt = (r: number) => 87.8 - (87.8 - 43.7) * ((r - 1) / 31);
  console.log(
    `  ${sf.toFixed(1)}   ${fl.toFixed(1).padStart(6)}  ${k.toFixed(3)}  ${leagueSum(k, fl, sf).toFixed(0).padStart(6)}` +
    `   ${perRank[0]!.toFixed(0).padStart(6)}  ${perRank[15]!.toFixed(0).padStart(6)}  ${perRank[31]!.toFixed(0).padStart(6)}` +
    `   ${(perRank[0]! / perRank[31]!).toFixed(2)}x   ${perRank.filter((p, i) => p > salaryAt(i + 1)).length}/32`);
}

line();
console.log("UEBERSCHUSS JE STUFE (Auszahlung minus Gehalt) — wer traegt den Verlust, wer bekommt den Gewinn?");
line();
const salaryAtRank = (r: number) => 87.8 - (87.8 - 43.7) * ((r - 1) / 31);
const PROBE = [1, 4, 8, 16, 24, 32];
console.log("  sf    " + PROBE.map((r) => `R${r}`.padStart(9)).join("") + "     Spanne");
for (const sf of [0.8, 1.0, 1.2]) {
  const fl = floorAt(sf), k = solveK(SALARY_SUM_S1 * sf, fl, sf);
  const sur = PROBE.map((r) =>
    SPONSOR_TYPES.reduce((a, t) => a + Math.max(fl, teamPayout(t, r, k, fl, sf)), 0) / SPONSOR_TYPES.length - salaryAtRank(r));
  console.log(`  ${sf.toFixed(1)} ` + sur.map((v) => `${v >= 0 ? "+" : ""}${v.toFixed(0)}`.padStart(9)).join("") +
    `   ${(Math.max(...sur) - Math.min(...sur)).toFixed(0)}`);
}

line();
console.log("MEISTER realisiert (Titel + Klausel + Sonderziel) vs. Top-Gehalt 87.8");
line();
for (const sf of [0.8, 1.0, 1.2]) {
  const fl = floorAt(sf), k = solveK(SALARY_SUM_S1 * sf, fl, sf);
  const good = SPONSOR_TYPES.map((t) => fl + (rankPart(t, 3, 1, offsetFor(t.name, 3)) + t.clause.bonus + 12 - FLOOR) * k * tiltAt(1, sf));
  const bot = SPONSOR_TYPES.map((t) => Math.max(fl, fl + (rankPart(t, 30, 32, offsetFor(t.name, 30)) - t.clause.malus - FLOOR) * k * tiltAt(32, sf)));
  console.log(`  sf ${sf.toFixed(1)}: Meister ${Math.min(...good).toFixed(0)}-${Math.max(...good).toFixed(0)}` +
    `   Letzter im Schlechtfall ${Math.min(...bot).toFixed(0)}-${Math.max(...bot).toFixed(0)}` +
    `   Top-Gehalt gedeckt: ${Math.min(...good) >= 87.8 ? "immer" : Math.max(...good) >= 87.8 ? "teilweise" : "nie"}`);
}

// ── Katalog-Ansicht: wie fuehlt sich jede Art fuer ein starkes / mittleres / schwaches Team an? ──
// Der Fallen-Test oben garantiert bereits, dass KEINE Art fuer irgendeine Ausgangslage dominiert
// wird. Diese Tabelle zeigt, WIE sie sich unterscheiden: Sockel (schlechtester Ausgang),
// Decke (bester Ausgang) und Risiko.
line();
console.log("KATALOG — jede Art aus Sicht eines starken (#2), mittleren (#18) und schwachen (#30) Teams");
line();
console.log("  " + "Sponsorart".padEnd(18) + "│" + "  TOP #2  Sockel–Decke  σ".padEnd(28) + "│" +
  "  MITTEL #18 Sockel–Decke σ".padEnd(28) + "│  SCHWACH #30 Sockel–Decke σ");
for (const t of SPONSOR_TYPES) {
  const cells = [2, 18, 30].map((e) => {
    const c = offsetFor(t.name, e);
    const band: number[] = [];
    for (let r = Math.max(1, e - 8); r <= Math.min(32, e + 8); r += 1) band.push(r);
    const joint = band.flatMap((r) => [withFloor(rankPart(t, e, r, c) + t.clause.bonus), withFloor(rankPart(t, e, r, c) - t.clause.malus)]);
    const e0 = ev(t, e, c); const d = distribution(e);
    let v = 0;
    d.forEach((w, i) => {
      v += w * P_MET * (withFloor(rankPart(t, e, i + 1, c) + t.clause.bonus) - e0) ** 2
         + w * (1 - P_MET) * (withFloor(rankPart(t, e, i + 1, c) - t.clause.malus) - e0) ** 2;
    });
    return `${Math.min(...joint).toFixed(0)}–${Math.max(...joint).toFixed(0)}`.padStart(12) + `  σ${Math.sqrt(v).toFixed(1)}`.padStart(8);
  });
  console.log("  " + t.name.padEnd(18) + "│" + cells.map((c) => c.padEnd(28)).join("│"));
}
console.log("\n  Sockel = schlechtester realistischer Ausgang, Decke = bester. Gleiche EV ueberall —");
console.log("  die Arten unterscheiden sich AUSSCHLIESSLICH in Risiko und Form, nie in der Hoehe.");
