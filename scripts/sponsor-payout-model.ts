/**
 * HISTORISCH — MISST DAS ALTE SPONSORSYSTEM (V1), DAS NICHT MEHR ERZEUGT WIRD.
 *
 * Dieses Skript rechnet die Auszahlung des ALTEN Angebotsmodells durch: Kurvenform-Payout-Tabellen,
 * Modul "Überperformance", Modul "Tabellenziel" und den rarity-gestaffelten Sonderziel-Betrag. Genau
 * diese Erzeugung ist entfernt worden — seit dem Aufräumen des Cutovers entsteht KEIN Angebot mehr
 * nach diesen Regeln. Wer die Zahlen des laufenden Systems will, nimmt `scripts/sponsor-v2-live-check.ts`
 * oder `lib/sponsor/sponsor-v2-model.ts`.
 *
 * Das Skript LÄUFT weiter und ist damit als Beleg reproduzierbar. Die beiden Modul-Konfigurationen
 * (Überperformance / Tabellenziel) sind unten als EINGEFRORENE KOPIEN hinterlegt, weil sie aus
 * `lib/sponsor/sponsor-economy-calibration.ts` entfernt wurden; die übrigen Funktionen (Kurven-Payout,
 * Cash-Beträge) sind noch echte Produktionsfunktionen, weil Altverträge sie zum Abrechnen brauchen.
 * Die frühere Zusage "kann nie von der tatsächlichen Auszahlung abdriften" gilt für dieses Skript
 * ausdrücklich NICHT mehr — es beschreibt einen abgeschlossenen Stand.
 *
 * Sponsor-Rechenmodell — theoretischer Durchrechner für Sponsoren-Auszahlungen.
 *
 * ZWECK (User-Vorgabe): "sauber ein Rechenmodell erstellen und in der Theorie verschiedene Positionen
 * oder Rangverbesserungen von Teams durchrechnen". Der Kernpunkt dahinter: es bringt NICHTS, dass die
 * Kurven in SUMME über alle 32 Ränge gleich viel zahlen (Σ≈1677, Gleichflächen-Normierung) — jedes Team
 * erlebt nur seinen EIGENEN Endrang. Dieses Modell rechnet deshalb konsequent PRO TEAM und PRO ERREICHBAREM
 * RANG, nicht über die Liga-Summe.
 *
 * WICHTIG: Das Modell IMPORTIERT die echten Produktionsfunktionen (sponsor-economy-calibration,
 * sponsor-curve-shapes, sponsor-tier-pool) und rechnet sie NICHT nach. Damit kann es nie von der
 * tatsächlichen Auszahlung abdriften — jede Balancing-Änderung schlägt sofort im Report durch.
 *
 * Verifiziert gegen eine reale Angebotskarte (Talanx Gruppe, konsolidierung/magisch, Erwartung #23):
 * bei sf=0.743 / Anker=44.1 reproduziert es 58.6 / 52.3 / 44.2 / 36.0 exakt (Abweichung 0).
 *
 * Aufruf:
 *   npx tsx scripts/sponsor-payout-model.ts
 *   npx tsx scripts/sponsor-payout-model.ts --expected 3,16,23,30 --rarity magisch --sigma 4
 *   npx tsx scripts/sponsor-payout-model.ts --calibrate 58.6,52.3,44.2,36.0   # Save-Parameter aus einer Karte lösen
 *   npx tsx scripts/sponsor-payout-model.ts --csv outputs/sponsor-model
 */

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { SponsorArchetype, SponsorCurveFamily, SponsorCurveShape, SponsorRarity } from "@/lib/data/olyDataTypes";
import {
  buildOfferCashAmounts,
  getSponsorCurveShapePayout,
  SPONSOR_SPECIAL_BASE_CAP_FRAC,
  SPONSOR_SPECIAL_BASE_SHARE,
  SPONSOR_SPECIAL_RARITY_STEP,
} from "@/lib/sponsor/sponsor-economy-calibration";
import {
  getSponsorCurveFamily,
  SPONSOR_CURVE_SHAPES,
  SPONSOR_RARITIES,
} from "@/lib/sponsor/sponsor-curve-shapes";

// ── EINGEFRORENE KOPIEN DES ENTFERNTEN V1-ERZEUGUNGSPFADS ──────────────────────────────────────────
// Diese vier Definitionen standen bis zum Aufräumen in lib/sponsor/sponsor-economy-calibration.ts bzw.
// lib/sponsor/sponsor-tier-pool.ts. Sie sind dort entfernt, weil kein Angebot mehr danach gebaut wird.
// Hier stehen sie als unveränderte Kopie, damit dieser historische Report weiter läuft und reproduzierbar
// bleibt. Sie sind KEINE Produktionswerte mehr — niemand darf sie von hier aus wieder importieren.
const LEGACY_OVERPERF_FAMILY: Record<SponsorCurveFamily, { rate: number; cap: number } | null> = {
  titel: { rate: 1.8, cap: 14 },
  europa: { rate: 1.2, cap: 10 },
  stetig: { rate: 0.8, cap: 6 },
  aufstieg: { rate: 0.6, cap: 5 },
  sicherheit: null,
};
const LEGACY_IMPROVEMENT_FAMILY: Record<SponsorCurveFamily, { rate: number; max: number }> = {
  titel: { rate: 0.6, max: 3 },
  europa: { rate: 1.0, max: 4 },
  stetig: { rate: 1.2, max: 5 },
  aufstieg: { rate: 1.5, max: 6 },
  sicherheit: { rate: 1.0, max: 5 },
};
function legacyOverperfConfig(family: SponsorCurveFamily, rarityOrder: number, salaryFactor = 1) {
  const cfg = LEGACY_OVERPERF_FAMILY[family];
  if (!cfg) return null;
  const rarityMult = 1 + 0.1 * rarityOrder;
  return {
    ratePerUnitC: Math.round(cfg.rate * rarityMult * salaryFactor * 10) / 10,
    cap: Math.round(cfg.cap * rarityMult * salaryFactor * 10) / 10,
  };
}
function legacyImprovementConfig(family: SponsorCurveFamily, salaryFactor = 1) {
  const cfg = LEGACY_IMPROVEMENT_FAMILY[family] ?? LEGACY_IMPROVEMENT_FAMILY.stetig;
  const ratePerUnitC = Math.round(cfg.rate * salaryFactor * 10) / 10;
  return { ratePerUnitC, maxUnits: cfg.max, cap: Math.round(ratePerUnitC * cfg.max * 10) / 10 };
}
/** Legacy-Kurvenform -> Archetyp; die Abbildung ist mit dem Erzeugungspfad aus lib/ entfernt worden. */
function legacyArchetypeOf(shape: SponsorCurveShape): SponsorArchetype {
  const family = getSponsorCurveFamily(shape);
  if (family === "titel") return "performance";
  if (family === "sicherheit") return "security";
  return "identity";
}

const SHAPES = Object.keys(SPONSOR_CURVE_SHAPES) as SponsorCurveShape[];
const RARITIES = Object.keys(SPONSOR_RARITIES) as SponsorRarity[];

const r1 = (value: number) => Math.round(value * 10) / 10;

// ── CLI ────────────────────────────────────────────────────────────────────────────────────────────
function arg(name: string): string | null {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

const EXPECTED_RANKS = (arg("expected") ?? "3,8,16,23,30").split(",").map((v) => Number(v.trim()));
const RARITY = (arg("rarity") ?? "magisch") as SponsorRarity;
const SIGMA = Number(arg("sigma") ?? 4);
const CSV_DIR = arg("csv");
/** salaryFactor + Rang-32-Ankergehalt der Liga. Defaults = die aus der realen Karte gelösten Werte. */
const SALARY_FACTOR = Number(arg("sf") ?? 0.743);
const LEAGUE_MIN = Number(arg("anchor") ?? 44.1);

// ── Kernmodell: die volle Auszahlung EINES Sponsors für EIN Team bei EINEM Endrang ────────────────
export type SponsorPayoutBreakdown = {
  basis: number;
  stufen: number;
  overperf: number;
  improve: number;
  special: number;
  total: number;
};

export function computeSponsorPayout(input: {
  shape: SponsorCurveShape;
  rarity: SponsorRarity;
  /** Tatsächlicher Endrang der Saison. */
  finalRank: number;
  /** Erwartungsrang (Stärkerang beim Signieren) — Baseline der Überperformance. */
  expectedRank: number;
  /** Startrang (Vorsaison-Platzierung) — Baseline des Tabellenziels. */
  startRank: number;
  qualityRank?: number;
  specialFulfilled?: boolean;
  salaryFactor?: number;
  leagueMin?: number;
  isGolden?: boolean;
}): SponsorPayoutBreakdown {
  const sf = input.salaryFactor ?? SALARY_FACTOR;
  const lm = input.leagueMin ?? LEAGUE_MIN;
  const golden = input.isGolden ?? false;
  const quality = input.qualityRank ?? input.expectedRank;
  const family = getSponsorCurveFamily(input.shape);

  // Gewinnstufen-Leiter (enthält bereits den garantierten Sockel): Basis = Auszahlung auf Rang 32.
  const curve = getSponsorCurveShapePayout(input.finalRank, sf, input.rarity, input.shape, lm, quality, golden);
  const floor = getSponsorCurveShapePayout(32, sf, input.rarity, input.shape, lm, quality, golden);

  // Modul "Überperformance": misst gegen den ERWARTUNGSRANG.
  const overperfCfg = legacyOverperfConfig(family, SPONSOR_RARITIES[input.rarity].order, sf);
  const overperf = overperfCfg
    ? Math.min(overperfCfg.cap, overperfCfg.ratePerUnitC * Math.max(0, input.expectedRank - input.finalRank))
    : 0;

  // Modul "Tabellenziel": misst gegen den STARTRANG (Vorsaison).
  const improveCfg = legacyImprovementConfig(family, sf);
  const improve = Math.min(
    improveCfg.cap,
    improveCfg.ratePerUnitC * Math.max(0, input.startRank - input.finalRank),
  );

  // Modul "Sonderziel": rang-UNABHÄNGIG, Betrag hängt nur an Rarity (nicht am gewählten Ziel!).
  const cash = buildOfferCashAmounts({
    archetype: legacyArchetypeOf(input.shape),
    salaryFactor: sf,
    rarity: input.rarity,
    leagueMinSalary: lm,
    teamQualityRank: quality,
    isGolden: golden,
  });
  const special = input.specialFulfilled ? cash.specialCash : 0;

  return {
    basis: r1(floor),
    stufen: r1(curve - floor),
    overperf: r1(overperf),
    improve: r1(improve),
    special: r1(special),
    total: r1(curve + overperf + improve + special),
  };
}

/** Diskretisierte Ergebnisverteilung eines Teams über die Endränge 1..32 (Normalverteilung um den Erwartungsrang). */
export function outcomeDistribution(expectedRank: number, sigma = SIGMA): number[] {
  const weights: number[] = [];
  for (let rank = 1; rank <= 32; rank += 1) {
    weights.push(Math.exp(-((rank - expectedRank) ** 2) / (2 * sigma * sigma)));
  }
  const sum = weights.reduce((a, b) => a + b, 0);
  return weights.map((w) => w / sum);
}

/** Erwartungswert der Auszahlung über die realistische Ergebnisverteilung des Teams. */
export function expectedValue(shape: SponsorCurveShape, expectedRank: number, rarity = RARITY, sigma = SIGMA) {
  const dist = outcomeDistribution(expectedRank, sigma);
  return dist.reduce(
    (acc, weight, index) =>
      acc +
      weight *
        computeSponsorPayout({
          shape,
          rarity,
          finalRank: index + 1,
          expectedRank,
          startRank: expectedRank,
        }).total,
    0,
  );
}

/** Der realistisch erreichbare Rangkorridor (±2σ, geklammert auf 1..32). */
export function reachableBand(expectedRank: number, sigma = SIGMA): number[] {
  const lo = Math.max(1, Math.round(expectedRank - 2 * sigma));
  const hi = Math.min(32, Math.round(expectedRank + 2 * sigma));
  return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
}

const out: string[] = [];
const say = (line = "") => {
  out.push(line);
  console.log(line);
};
const rule = (char = "=") => say(char.repeat(104));

// ── 0. Kalibrier-Modus: Save-Parameter aus einer echten Angebotskarte lösen ────────────────────────
const calibrate = arg("calibrate");
if (calibrate) {
  const [r1v, r24v, r28v, r32v] = calibrate.split(",").map((v) => Number(v.trim()));
  const shape = (arg("shape") ?? "konsolidierung") as SponsorCurveShape;
  const q = Number(arg("quality") ?? 23);
  let best: { sf: number; anchor: number; err: number } | null = null;
  for (let sf = 0.6; sf <= 1.2; sf += 0.001) {
    for (let anchor = 28; anchor <= 75; anchor += 0.1) {
      const L = (rank: number) => getSponsorCurveShapePayout(rank, sf, RARITY, shape, anchor, q, false);
      const err =
        Math.abs(L(1) - r1v) + Math.abs(L(24) - r24v) + Math.abs(L(28) - r28v) + Math.abs(L(32) - r32v);
      if (!best || err < best.err) best = { sf: +sf.toFixed(3), anchor: +anchor.toFixed(1), err: +err.toFixed(2) };
    }
  }
  say(`Kalibrierung ${shape}/${RARITY} q=${q} → sf=${best!.sf} anchor=${best!.anchor} (Abweichung ${best!.err})`);
  say(`Weiterverwenden mit:  --sf ${best!.sf} --anchor ${best!.anchor}`);
  process.exit(0);
}

// ── Report ─────────────────────────────────────────────────────────────────────────────────────────
rule();
say("SPONSOR-RECHENMODELL — pro Team und pro erreichbarem Rang (nicht über die Liga-Summe)");
rule();
say(`Parameter: salaryFactor=${SALARY_FACTOR}  Rang32-Anker=${LEAGUE_MIN}  Rarity=${RARITY}  sigma=${SIGMA}`);
say(`Kurven: ${SHAPES.length}   Erwartungsränge: ${EXPECTED_RANKS.join(", ")}`);

// 1 — Gleichflächen-Nachweis: DAS ist die Invariante, die heute gilt (und die niemand erlebt).
say();
rule("-");
say("1. IST-INVARIANTE: Fläche der Kurven über ALLE 32 Ränge (das, was heute gleichgesetzt wird)");
rule("-");
for (const shape of SHAPES) {
  const sum = Array.from({ length: 32 }, (_, i) =>
    computeSponsorPayout({ shape, rarity: RARITY, finalRank: i + 1, expectedRank: 16, startRank: 16 }).basis +
    computeSponsorPayout({ shape, rarity: RARITY, finalRank: i + 1, expectedRank: 16, startRank: 16 }).stufen,
  ).reduce((a, b) => a + b, 0);
  say(`  ${shape.padEnd(16)} Σ(Rang 1..32) = ${sum.toFixed(0)}`);
}
say("  → Alle nahezu identisch. Diese Gleichheit erlebt aber KEIN Team: jedes hat nur EINEN Endrang.");

// 2 — Szenario-Matrizen pro Erwartungsrang
const csvRows: string[] = ["expectedRank,shape,finalRank,basis,stufen,overperf,improve,special,total"];
for (const expected of EXPECTED_RANKS) {
  say();
  rule();
  say(`2. TEAM mit Erwartungsrang #${expected} (Startrang #${expected}) — Gesamtauszahlung je Endrang`);
  rule();
  const band = reachableBand(expected);
  const cols = [...new Set([32, 28, 24, expected, 16, 12, 8, 4, 1])].sort((a, b) => b - a);
  say("Kurve".padEnd(16) + cols.map((c) => `R${c}`.padStart(7)).join("") + "      EV" + "   erreichbar");
  const rows = SHAPES.map((shape) => ({
    shape,
    vals: cols.map(
      (c) => computeSponsorPayout({ shape, rarity: RARITY, finalRank: c, expectedRank: expected, startRank: expected }).total,
    ),
    ev: expectedValue(shape, expected),
    bandVals: band.map(
      (c) => computeSponsorPayout({ shape, rarity: RARITY, finalRank: c, expectedRank: expected, startRank: expected }).total,
    ),
  })).sort((a, b) => b.ev - a.ev);

  for (const row of rows) {
    say(
      row.shape.padEnd(16) +
        row.vals.map((v) => v.toFixed(1).padStart(7)).join("") +
        row.ev.toFixed(1).padStart(8) +
        `   ${Math.min(...row.bandVals).toFixed(0)}–${Math.max(...row.bandVals).toFixed(0)}`,
    );
    for (let rank = 1; rank <= 32; rank += 1) {
      const p = computeSponsorPayout({ shape: row.shape, rarity: RARITY, finalRank: rank, expectedRank: expected, startRank: expected });
      csvRows.push(`${expected},${row.shape},${rank},${p.basis},${p.stufen},${p.overperf},${p.improve},${p.special},${p.total}`);
    }
  }
  const best = rows[0]!;
  const worst = rows[rows.length - 1]!;
  say(
    `SPREAD EV: beste (${best.shape}) ${best.ev.toFixed(1)} vs schlechteste (${worst.shape}) ${worst.ev.toFixed(1)}` +
      ` = +${(best.ev - worst.ev).toFixed(1)} C / ${((best.ev / worst.ev - 1) * 100).toFixed(0)} %`,
  );

  // Dominanz-Test: gibt es Kurven, die im ERREICHBAREN Korridor bei JEDEM Rang schlechter sind?
  const dominated: string[] = [];
  for (const candidate of rows) {
    for (const other of rows) {
      if (candidate.shape === other.shape) continue;
      if (candidate.bandVals.every((v, i) => v <= other.bandVals[i]!) &&
          candidate.bandVals.some((v, i) => v < other.bandVals[i]!)) {
        dominated.push(`${candidate.shape} < ${other.shape}`);
        break;
      }
    }
  }
  say(
    `DOMINANZ im erreichbaren Korridor R${band[0]}–R${band[band.length - 1]}: ` +
      (dominated.length === 0
        ? "keine — jede Kurve hat ein eigenes Gewinnband (gesund)"
        : `${dominated.length}/${SHAPES.length} Kurven sind FALLEN (bei jedem erreichbaren Rang schlechter):`),
  );
  for (const d of dominated) say(`    ✗ ${d}`);
}

// 3 — Rangverbesserung: was zahlt ein Aufstieg wirklich, und woher kommt das Geld?
say();
rule();
say("3. RANGVERBESSERUNG — Zerlegung des Zuwachses (wer zahlt den Aufstieg?)");
rule();
for (const expected of EXPECTED_RANKS) {
  const seenTargets = new Set<number>();
  for (const step of [3, 6]) {
    const target = Math.max(1, expected - step);
    if (target === expected || seenTargets.has(target)) continue;
    seenTargets.add(target);
    say();
    say(`  Aufstieg #${expected} → #${target} (${expected - target} Plätze):`);
    say(
      "    " + "Kurve".padEnd(16) + "Stufen+".padStart(9) + "Überperf".padStart(10) + "Tabellenz.".padStart(11) +
        "Bonus-Σ".padStart(9) + "Zuwachs".padStart(9) + "Bonus-Anteil".padStart(14),
    );
    for (const shape of SHAPES) {
      const a = computeSponsorPayout({ shape, rarity: RARITY, finalRank: expected, expectedRank: expected, startRank: expected });
      const b = computeSponsorPayout({ shape, rarity: RARITY, finalRank: target, expectedRank: expected, startRank: expected });
      const dStufen = r1(b.stufen - a.stufen);
      const bonus = r1(b.overperf + b.improve);
      const growth = r1(b.total - a.total);
      say(
        "    " + shape.padEnd(16) + dStufen.toFixed(1).padStart(9) + b.overperf.toFixed(1).padStart(10) +
          b.improve.toFixed(1).padStart(11) + bonus.toFixed(1).padStart(9) + growth.toFixed(1).padStart(9) +
          `${growth > 0 ? ((bonus / growth) * 100).toFixed(0) : "-"} %`.padStart(14),
      );
    }
  }
}
say();
say("  HINWEIS: 'Überperf' misst gegen den Erwartungsrang, 'Tabellenz.' gegen den Startrang. Bei einem");
say("  stabilen Team sind das DIESELBE Zahl → beide Module feuern auf dasselbe Ereignis (Doppelzählung).");

// 4 — Sonderziele
say();
rule();
say("4. SONDERZIELE — Betrag und Preisbildung");
rule();
say("Sonderziel-Betrag je Rarity (Anteil am Titel-Etat, gedeckelt bei 30 % der Basis):");
for (const rarity of RARITIES) {
  const order = SPONSOR_RARITIES[rarity].order;
  const cash = buildOfferCashAmounts({
    archetype: "identity", salaryFactor: SALARY_FACTOR, rarity, leagueMinSalary: LEAGUE_MIN, teamQualityRank: 23,
  });
  const share = SPONSOR_SPECIAL_BASE_SHARE + SPONSOR_SPECIAL_RARITY_STEP * order;
  say(
    `  ${rarity.padEnd(12)} Anteil ${(share * 100).toFixed(0).padStart(2)} % → ${cash.specialCash.toFixed(1).padStart(5)} C` +
      `   (Basis ${cash.baseCash.toFixed(1)}, Deckel ${(cash.baseCash * SPONSOR_SPECIAL_BASE_CAP_FRAC).toFixed(1)})`,
  );
}
say();
say("BEFUND: `specialCash` hängt AUSSCHLIESSLICH an der Rarity — NICHT am gewählten Ziel. Alle 25 Bonus-");
say("ziele + 6 Golden-Ziele zahlen bei gleicher Rarity exakt denselben Betrag. Ein für ein schwaches Team");
say("leichtes Ziel ('cellar_escape') zahlt genauso viel wie ein fast unmögliches ('golden_title_shock').");
say("→ Es gibt keine Schwierigkeits-Bepreisung. Das ist der größte ungenutzte Hebel im Sponsorensystem.");

// 5 — Modul-Gewichte: woraus besteht die Auszahlung eines typischen Teams?
say();
rule();
say("5. MODUL-GEWICHTE bei Erfüllung aller Ziele (Erwartungsrang → Endrang = Erwartung)");
rule();
say("Kurve".padEnd(16) + "Basis".padStart(8) + "Stufen".padStart(8) + "Überp.".padStart(8) + "Tabelle".padStart(9) + "Sonder".padStart(8) + "Total".padStart(8));
for (const expected of EXPECTED_RANKS) {
  say(`  — Erwartungsrang #${expected} —`);
  for (const shape of SHAPES) {
    const p = computeSponsorPayout({
      shape, rarity: RARITY, finalRank: expected, expectedRank: expected, startRank: expected + 3, specialFulfilled: true,
    });
    say(
      shape.padEnd(16) + p.basis.toFixed(1).padStart(8) + p.stufen.toFixed(1).padStart(8) +
        p.overperf.toFixed(1).padStart(8) + p.improve.toFixed(1).padStart(9) +
        p.special.toFixed(1).padStart(8) + p.total.toFixed(1).padStart(8),
    );
  }
}

if (CSV_DIR) {
  mkdirSync(CSV_DIR, { recursive: true });
  writeFileSync(path.join(CSV_DIR, "sponsor-payout-matrix.csv"), csvRows.join("\n"), "utf8");
  writeFileSync(path.join(CSV_DIR, "sponsor-model-report.txt"), out.join("\n"), "utf8");
  console.log(`\nGeschrieben: ${path.join(CSV_DIR, "sponsor-payout-matrix.csv")} (+ report.txt)`);
}
