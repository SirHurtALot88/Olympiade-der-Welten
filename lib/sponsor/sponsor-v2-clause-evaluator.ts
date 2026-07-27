/**
 * P3 — KLAUSEL-AUSWERTUNG fuer OLY_SPONSOR_V2.
 *
 * Bewusst KLEIN gehalten: hier stehen nur die Klauseln, die am Saison-END-ZUSTAND **trivial**
 * messbar sind — aus einem saison-getaggten Ledger oder aus dem Kader, wie er am Saisonende
 * dasteht. Lieber zehn funktionierende Klauseln als zwanzig halbe.
 *
 * WAS BEWUSST FEHLT UND WARUM (gemessen im Engine-Schattentest, docs/SPONSOR_SCHATTENTEST_ENGINE.md):
 *   - Einsatzlast / Schonung   brauchen den Saison-Fatigue-Schnitt. Der ist nur ueber eine
 *                              Rekonstruktion aus `injuryEvents.fatigueBefore` zu haben — machbar,
 *                              aber keine triviale End-Zustands-Groesse. Nicht im Pool.
 *   - Achsenprofil             braucht die liga-weite Achsenrangliste. Vorhanden, aber teuer und
 *                              vom Zeitpunkt abhaengig. Nicht im Pool.
 *   - Disziplinen              braucht `previousDisciplineRatings`, das an der Saisongrenze
 *                              ueberschrieben wird. Nicht im Pool.
 *   - Wortlaut                 braucht `playerRelationshipEvents` mit dem Grund
 *                              `promised_role_broken`. Trivial zaehlbar, aber der Grund-String ist
 *                              nicht typisiert; erst aufnehmen, wenn das Feld abgesichert ist.
 * Die fuenf gestrichenen Klauseln (Charakterarbeit, Kapitaenstreue, Hartes Training, XP-Disziplin,
 * Beliebtheit) sind schon aus dem Katalog raus.
 *
 * SCHWELLEN: die Werte kommen aus der Messung ueber 128-160 echte Team-Saisons
 * (`scripts/sponsor-shadow-measure.ts`), nicht aus dem Bauch. Wo die Verteilung ueber die
 * Staerkeklassen deutlich auseinanderlaeuft, ist die Schwelle klassenrelativ gesetzt — sonst waere
 * sie fuer Top-Teams geschenkt und fuer schwache unmoeglich. Sie stehen auf EINEM Engine-Lauf und
 * gehoeren nachgemessen, sobald ein zweiter vorliegt.
 */
import type { GameState } from "@/lib/data/olyDataTypes";

import { getTeamDisplaySalaryTotal } from "@/lib/sponsor/sponsor-team-salary-display";
import { SPONSOR_V2_CLAUSES, type SponsorV2Clause } from "@/lib/sponsor/sponsor-v2-model";

/** Staerkeklasse nach Erwartungsrang — dieselbe Dreiteilung wie in der Messung. */
export type SponsorV2StrengthClass = 0 | 1 | 2;
export function sponsorV2StrengthClassOf(expectedRank: number): SponsorV2StrengthClass {
  if (expectedRank <= 11) return 0;
  if (expectedRank <= 21) return 1;
  return 2;
}

/**
 * Schwellen je Klausel. `perClass` gewinnt, wenn gesetzt; sonst gilt `pooled`.
 * Die Kommentare nennen das gemessene P bei genau dieser Schwelle.
 */
type ThresholdSpec = { pooled: number; perClass?: [number, number, number]; unit: string; note: string };
const THRESHOLDS: Record<string, ThresholdSpec> = {
  // Aufstiege aus classHistory. Gemessen P 0.36 bei >= 1 (Design 0.40, Abstand 0.04).
  Talentschmiede: { pooled: 1, unit: "Klassenaufstiege", note: "P 0.36 bei X>=1 (Design 0.40)" },
  // Kaderwert-Wachstum in Prozent. Gemessen P 0.50 bei >= +0.58 % (Design 0.50).
  Wertaufbau: { pooled: 0.58, unit: "% Kaderwert", note: "P 0.50 bei X>=+0.58 % (Design 0.50)" },
  // Neue Kredite dieser Saison. Feste Schwelle 0, direkt gemessen P 0.94 (Design 0.85).
  Schuldenfrei: { pooled: 0, unit: "neue Kredite", note: "P 0.94 bei X<=0 (Design 0.85)" },
  // Gehaltssumme. Verteilung stark klassenabhaengig (Median stark 69.2 / mittel 58.5 / schwach 52.8) —
  // eine absolute Schwelle waere fuer die Spitze unmoeglich und fuer den Keller geschenkt.
  Gehaltseffizienz: { pooled: 57.24, perClass: [69.2, 58.5, 52.8], unit: "Gehaltssumme C",
    note: "P 0.50 gepoolt bei X<=57.2; klassenrelativ auf die jeweiligen Mediane" },
  // Transfers (Zu- und Abgaenge). Gemessen P 0.60 bei <= 8 (Design 0.60).
  Kaderruhe: { pooled: 8, unit: "Transfers", note: "P 0.60 bei X<=8 (Design 0.60)" },
  // Gebaeude-Stufenaufstiege, ALLE Gebaeude. Gemessen P 0.59 bei >= 1 (Design 0.60).
  Ausbau: { pooled: 1, unit: "Gebaeudestufen", note: "P 0.59 bei X>=1 (Design 0.60)" },
  // Verletzungen. Gemessen P 0.51 bei <= 6 (Design 0.45, Abstand 0.06).
  Prophylaxe: { pooled: 6, unit: "Verletzungen", note: "P 0.51 bei X<=6 (Design 0.45)" },
  // OE-Moral am Saisonende. Gemessen P 0.56 bei >= 48.1 (Design 0.55).
  Moral: { pooled: 48.06, unit: "OE-Moral", note: "P 0.56 bei X>=48.1 (Design 0.55)" },
  // Verschiedene Subklassen. Median stark 14 / mittel 12 / schwach 8 — klassenrelativ.
  Vielseitigkeit: { pooled: 12, perClass: [14, 12, 8], unit: "Subklassen",
    note: "P 0.53 gepoolt bei X>=12; klassenrelativ auf die jeweiligen Mediane" },
  // Groesste Trainingsklassen-Gruppe. Gemessen P 0.50 bei >= 5 (Design 0.55, Abstand 0.05).
  Fokusschule: { pooled: 5, unit: "Spieler je Trainingsklasse", note: "P 0.50 bei X>=5 (Design 0.55)" },
};

/** Die Klauseln, die dieser Evaluator wirklich auswerten kann — der Produktions-Pool von V2. */
export const SPONSOR_V2_EVALUABLE_CLAUSES: readonly SponsorV2Clause[] =
  SPONSOR_V2_CLAUSES.filter((c) => c.evaluable && THRESHOLDS[c.name] != null);

export function sponsorV2ThresholdFor(clauseName: string, expectedRank: number): number | null {
  const spec = THRESHOLDS[clauseName];
  if (!spec) return null;
  if (spec.perClass) return spec.perClass[sponsorV2StrengthClassOf(expectedRank)]!;
  return spec.pooled;
}
export function sponsorV2ThresholdUnit(clauseName: string): string {
  return THRESHOLDS[clauseName]?.unit ?? "";
}

// ── Metriken ───────────────────────────────────────────────────────────────────────────────────
type MetricContext = { gameState: GameState; teamId: string; seasonId: string };

const rosterPlayerIds = (gs: GameState, teamId: string): Set<string> =>
  new Set(gs.rosters.filter((r) => r.teamId === teamId).map((r) => r.playerId));

/**
 * Marktwertsumme des Kaders JETZT. Bewusst aus dem lebenden Kader und nicht aus dem
 * Saison-Snapshot: der Snapshot der laufenden Saison entsteht erst waehrend des Saisonabschlusses,
 * die Auswertung liefe sonst je nach Aufrufzeitpunkt gegen einen anderen Wert.
 */
function currentMarketValueTotal(gs: GameState, teamId: string): number {
  const ids = rosterPlayerIds(gs, teamId);
  let sum = 0;
  for (const p of gs.players) if (ids.has(p.id)) sum += Number(p.marketValue ?? 0);
  return sum;
}

/** Marktwertsumme am Ende der VORSAISON aus dem Snapshot (zwei Feldgenerationen). */
function previousSeasonMarketValueTotal(gs: GameState, teamId: string, seasonId: string): number | null {
  const snaps = (gs.seasonState.seasonSnapshots ?? []).filter((s) => (s.finalStandings ?? []).length > 0);
  const num = (id: string) => { const m = /(\d+)/.exec(id); return m ? Number(m[1]) : 0; };
  const prior = snaps.filter((s) => num(s.seasonId) < num(seasonId)).sort((a, b) => num(a.seasonId) - num(b.seasonId));
  const last = prior.at(-1);
  if (!last) return null;
  const row = last.finalStandings.find((r) => r.teamId === teamId);
  if (!row) return null;
  const wide = row as unknown as Record<string, unknown>;
  const total = wide["marketValueTotalEnd"];
  if (typeof total === "number") return total;
  return typeof row.marketValueEnd === "number" ? row.marketValueEnd : null;
}

const METRICS: Record<string, (c: MetricContext) => number | null> = {
  Talentschmiede: (c) => {
    const ids = rosterPlayerIds(c.gameState, c.teamId);
    let n = 0;
    for (const p of c.gameState.players) {
      if (!ids.has(p.id)) continue;
      n += (p.classHistory ?? []).filter((e) => e.seasonId === c.seasonId && e.reason !== "seed").length;
    }
    return n;
  },
  Wertaufbau: (c) => {
    const before = previousSeasonMarketValueTotal(c.gameState, c.teamId, c.seasonId);
    if (before == null || before <= 0) return null; // Saison 1 hat keinen Vorwert
    return (100 * (currentMarketValueTotal(c.gameState, c.teamId) - before)) / before;
  },
  Schuldenfrei: (c) => {
    // BEIDE Quellen lesen: der Origination-Ledger ist in aelteren Saves leer, die Kredite selbst
    // stehen aber im State. Wer nur den Ledger liest, misst faelschlich immer 0.
    const fromLedger = (c.gameState.seasonState.loanOriginationLogs ?? [])
      .filter((l) => l.seasonId === c.seasonId && l.borrowerTeamId === c.teamId).length;
    const fromLoans = (c.gameState.seasonState.loans ?? [])
      .filter((l) => l.originatedSeasonId === c.seasonId && l.borrowerTeamId === c.teamId).length;
    return Math.max(fromLedger, fromLoans);
  },
  Gehaltseffizienz: (c) => getTeamDisplaySalaryTotal(c.gameState, c.teamId),
  Kaderruhe: (c) => (c.gameState.transferHistory ?? []).filter((t) =>
    t.seasonId === c.seasonId && (t.fromTeamId === c.teamId || t.toTeamId === c.teamId)).length,
  Ausbau: (c) => (c.gameState.seasonState.facilityEvents ?? []).filter((e) =>
    e.seasonId === c.seasonId && e.teamId === c.teamId && e.nextLevel > e.previousLevel).length,
  Prophylaxe: (c) => (c.gameState.seasonState.injuryEvents ?? []).filter((e) =>
    e.seasonId === c.seasonId && e.teamId === c.teamId && e.result === "injured").length,
  Moral: (c) => {
    const vals = (c.gameState.playerMoraleState ?? [])
      .filter((s) => s.teamId === c.teamId).map((s) => s.morale).filter((v) => Number.isFinite(v));
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  },
  Vielseitigkeit: (c) => {
    const ids = rosterPlayerIds(c.gameState, c.teamId);
    const set = new Set<string>();
    for (const p of c.gameState.players) if (ids.has(p.id)) for (const s of p.subclasses ?? []) set.add(s);
    return set.size;
  },
  Fokusschule: (c) => {
    const ids = rosterPlayerIds(c.gameState, c.teamId);
    const counts = new Map<string, number>();
    let n = 0;
    for (const p of c.gameState.players) {
      if (!ids.has(p.id)) continue;
      const cls = p.trainingClass ?? p.className;
      if (!cls) continue;
      counts.set(cls, (counts.get(cls) ?? 0) + 1);
      n += 1;
    }
    return n === 0 ? null : Math.max(...counts.values());
  },
};

export type SponsorV2ClauseResult = {
  clauseName: string;
  /** null = nicht auswertbar (fehlende Datengrundlage). */
  metric: number | null;
  threshold: number | null;
  direction: "up" | "down";
  met: boolean;
  /** true, wenn `met` mangels Daten geschenkt wurde statt gemessen. */
  assumedMet: boolean;
  label: string;
  unit: string;
};

/**
 * Wertet eine Klausel am Saison-End-Zustand aus.
 *
 * KEINE DATEN HEISST ERFUELLT — bewusst, und mit `assumedMet` sichtbar gemacht. Ein Malus, den der
 * Spieler nicht abwenden konnte, weil die Metrik gar nicht existiert, waere genau der Fehler, den
 * der Engine-Test bei der Klausel "Wortlaut" gefunden hat (P = 0.00 in 160 Team-Saisons, also ein
 * garantierter Abzug). Im Zweifel zugunsten des Spielers, und der Fall wird ausgewiesen statt
 * verschluckt.
 */
export function sponsorV2EvaluateClause(input: {
  gameState: GameState; teamId: string; seasonId: string; clauseName: string; expectedRank: number;
}): SponsorV2ClauseResult {
  const clause = SPONSOR_V2_CLAUSES.find((c) => c.name === input.clauseName);
  const metricFn = METRICS[input.clauseName];
  const threshold = sponsorV2ThresholdFor(input.clauseName, input.expectedRank);
  const direction = clause?.direction ?? "up";
  const base = {
    clauseName: input.clauseName,
    threshold,
    direction,
    label: clause?.label ?? input.clauseName,
    unit: sponsorV2ThresholdUnit(input.clauseName),
  };
  if (!clause || !metricFn || threshold == null) {
    return { ...base, metric: null, met: true, assumedMet: true };
  }
  const metric = metricFn({ gameState: input.gameState, teamId: input.teamId, seasonId: input.seasonId });
  if (metric == null || !Number.isFinite(metric)) {
    return { ...base, metric: null, met: true, assumedMet: true };
  }
  const met = direction === "up" ? metric >= threshold : metric <= threshold;
  return { ...base, metric, met, assumedMet: false };
}
