/* eslint-disable no-console */
/**
 * WAS EIN FAKTORPAAR WIRKLICH KOSTET — Linien, Zahler, Topf und der Einzelfall.
 *
 * CHRIS: „gut was käme raus wenn wir apron 1 ab 1,25 machen und apron 2 ab 1,6?"
 *
 * `messe-apron-linien.ts` beantwortet nur, WER ueber die Linie rutscht. Diese Messung rechnet die
 * Abgabe dazu — mit denselben Produktionsfunktionen, nur mit anderen Linien gefuettert
 * (`computeApronSettlement` nimmt sie als Eingabe). Zusaetzlich beide Hebelformen, weil Chris'
 * zweite offene Frage die Stufe ist.
 *
 * Aufruf:
 *   OLY_APP_SQLITE_PATH=<pfad> npx tsx scripts/messe-apron-faktoren-wirkung.ts [--faktoren 1.1,1.25 1.25,1.6]
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import type { GameState } from "@/lib/data/olyDataTypes";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import {
  APRON_KONJUNKTUR_FACTOR_MIN,
  APRON_LINE_1_MEDIAN_FACTOR,
  APRON_LINE_2_MEDIAN_FACTOR,
  apronWertungsanteil,
  computeApronSettlement,
  getTeamApronSalaryBase,
  resolveApronSalaryFactor,
  resolveSeasonApronLines,
} from "@/lib/season/apron-service";

function r(value: number, stellen = 1): number {
  const f = 10 ** stellen;
  return Math.round(value * f) / f;
}

function argFaktoren(): Array<[number, number]> {
  const argv = process.argv.slice(2);
  const i = argv.indexOf("--faktoren");
  const roh = i >= 0 ? argv.slice(i + 1) : [`${APRON_LINE_1_MEDIAN_FACTOR},${APRON_LINE_2_MEDIAN_FACTOR}`, "1.25,1.6"];
  return roh
    .map((paar) => paar.split(",").map((x) => Number(x.trim())))
    .filter((p) => p.length === 2 && p.every((n) => Number.isFinite(n)))
    .map((p) => [p[0]!, p[1]!] as [number, number]);
}

function raenge(gameState: GameState): Map<string, number> {
  const standings = (gameState.seasonState?.standings ?? {}) as Record<string, { points?: number }>;
  const sortiert = Object.entries(standings)
    .map(([teamId, row]) => ({ teamId, punkte: row?.points ?? 0 }))
    .sort((a, b) => b.punkte - a.punkte || a.teamId.localeCompare(b.teamId));
  const map = new Map<string, number>();
  sortiert.forEach((row, index) => map.set(row.teamId, index + 1));
  return map;
}

function abrechnung(gameState: GameState, f1: number, f2: number, alsStufe: boolean) {
  const salaryFactor = resolveApronSalaryFactor(gameState);
  const median = resolveSeasonApronLines(gameState).medianSalary;
  const lines = { line1: median * f1, line2: median * f2 };
  const rang = raenge(gameState);
  const teams = gameState.teams.map((team) => ({
    teamId: team.teamId,
    salary: getTeamApronSalaryBase(gameState, team.teamId),
    rankShare: apronWertungsanteil(rang.get(team.teamId) ?? gameState.teams.length, salaryFactor),
  }));
  const s: any = computeApronSettlement({
    lines,
    salaryFactor,
    teams,
    konjunkturFactorMin: APRON_KONJUNKTUR_FACTOR_MIN,
    konjunkturFactorMax: alsStufe ? APRON_KONJUNKTUR_FACTOR_MIN : undefined,
  });
  const rows = s.rows ?? s.teams ?? [];
  const zahler = rows.filter((row: any) => (row.abgabe ?? 0) > 0.005);
  return {
    lines,
    salaryFactor,
    median,
    rows,
    zahler: zahler.length,
    topf: rows.reduce((sum: number, row: any) => sum + (row.abgabe ?? 0), 0),
    amDeckel: zahler.filter((row: any) => row.deckel != null && Math.abs(row.abgabe - row.deckel) < 0.01).length,
    empfaenger: rows.filter((row: any) => (row.ausgleich ?? 0) > 0.005).length,
  };
}

async function main() {
  const faktoren = argFaktoren();
  const persistence = createPersistenceService();

  for (const kopf of persistence.listSaves()) {
    const save = persistence.getSaveById(kopf.saveId);
    if (!save) continue;
    const gs = save.gameState as GameState;
    if ((gs.teams ?? []).length === 0) continue;

    let kopfzeileGedruckt = false;
    for (const [f1, f2] of faktoren) {
      for (const alsStufe of [false, true]) {
        const a = abrechnung(gs, f1, f2, alsStufe);
        if (!kopfzeileGedruckt) {
          console.log(
            `\n=== ${kopf.saveId.slice(-6)} · ${gs.season.id} · Median ${r(a.median)} · f=${r(a.salaryFactor, 2)}`,
          );
          console.log("  Faktoren      L1     L2   Hebel  |  Zahler  Topf    am Deckel  Empf.  |  M-M");
          kopfzeileGedruckt = true;
        }
        const mm = a.rows.find((row: any) => row.teamId === "M-M");
        const mmText = mm
          ? `${r(mm.abgabe).toFixed(1)}${mm.deckel != null && Math.abs(mm.abgabe - mm.deckel) < 0.01 ? " (Deckel)" : ""} von roh ${r(mm.rohAbgabe ?? 0).toFixed(1)}`
          : "—";
        const heute = f1 === APRON_LINE_1_MEDIAN_FACTOR && f2 === APRON_LINE_2_MEDIAN_FACTOR && !alsStufe ? " ← heute" : "";
        console.log(
          `  ${f1.toFixed(3)}/${f2.toFixed(2)}  ${r(a.lines.line1).toFixed(1).padStart(6)} ${r(a.lines.line2).toFixed(1).padStart(6)}  ` +
            `${(alsStufe ? "Stufe" : "Rampe").padEnd(6)} |${String(a.zahler).padStart(6)} ${r(a.topf).toFixed(1).padStart(7)} ` +
            `${String(a.amDeckel).padStart(9)} ${String(a.empfaenger).padStart(6)}  |  ${mmText}${heute}`,
        );
      }
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
