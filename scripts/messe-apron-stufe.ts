/* eslint-disable no-console */
/**
 * RAMPE GEGEN STUFE — was ändert sich, wenn der Apron über der Schwelle SOFORT voll zieht?
 *
 * CHRIS' EINWAND zu `6fv43h`: „hä moment wieso zieht der apron nur zu 14%? ist ja okay wenn er
 * unter 0,95 nicht zieht aber darüber müsste M-M den vollen betrag zahlen! das ist nicht nur
 * kleiner teil oder so sondern direkt BAM in your face".
 *
 * Die Senkung der Schwelle (0,95 → 0,88) hat den ANFANG der Rampe verschoben, nicht ihre Form.
 * Über der Schwelle zahlt ein Team weiterhin nur den Bruchteil `k(f)`. Chris will die Stufe:
 * unter der Schwelle nichts, ab der Schwelle voll.
 *
 * Gerechnet wird über die ECHTEN Produktionsfunktionen. Die Stufe entsteht NICHT durch eine zweite
 * Formel, sondern dadurch, dass die Rampe keine Breite mehr hat (`konjunkturFactorMax` == `-Min`);
 * genau diesen Fall behandelt `apronKonjunkturhebel` seit jeher, er war nur nicht erreichbar.
 *
 * Aufruf:
 *   OLY_APP_SQLITE_PATH=<pfad> npx tsx scripts/messe-apron-stufe.ts [--schwelle 0.88]
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import type { GameState } from "@/lib/data/olyDataTypes";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import {
  APRON_KONJUNKTUR_FACTOR_MIN,
  apronKonjunkturhebel,
  apronWertungsanteil,
  computeApronSettlement,
  getTeamApronSalaryBase,
  resolveApronSalaryFactor,
  resolveApronSalaryFactorForNextSeason,
  resolveSeasonApronLines,
} from "@/lib/season/apron-service";

function r(value: number, stellen = 1): number {
  const f = 10 ** stellen;
  return Math.round(value * f) / f;
}

function argSchwelle(): number {
  const argv = process.argv.slice(2);
  const i = argv.indexOf("--schwelle");
  const roh = i >= 0 ? Number(argv[i + 1]) : APRON_KONJUNKTUR_FACTOR_MIN;
  return Number.isFinite(roh) ? roh : APRON_KONJUNKTUR_FACTOR_MIN;
}

function raengeAusStand(gameState: GameState): Map<string, number> {
  const standings = (gameState.seasonState?.standings ?? {}) as Record<string, { points?: number }>;
  const sortiert = Object.entries(standings)
    .map(([teamId, row]) => ({ teamId, punkte: row?.points ?? 0 }))
    .sort((a, b) => b.punkte - a.punkte || a.teamId.localeCompare(b.teamId));
  const raenge = new Map<string, number>();
  sortiert.forEach((row, index) => raenge.set(row.teamId, index + 1));
  return raenge;
}

function abrechnung(gameState: GameState, salaryFactor: number, schwelle: number, alsStufe: boolean) {
  const lines = resolveSeasonApronLines(gameState);
  const raenge = raengeAusStand(gameState);
  const teams = (gameState.teams ?? []).map((team) => {
    const rang = raenge.get(team.teamId) ?? gameState.teams.length;
    return {
      teamId: team.teamId,
      salary: getTeamApronSalaryBase(gameState, team.teamId),
      rankShare: apronWertungsanteil(rang, salaryFactor),
    };
  });
  return computeApronSettlement({
    lines,
    salaryFactor,
    teams,
    konjunkturFactorMin: schwelle,
    // Rampe ohne Breite = Stufe. Weggelassen bleibt es die heutige Rampe.
    konjunkturFactorMax: alsStufe ? schwelle : undefined,
  });
}

function summe(s: any): { zahler: number; topf: number; amDeckel: number } {
  const rows = s.rows ?? s.teams ?? [];
  const zahler = rows.filter((row: any) => (row.abgabe ?? 0) > 0.005);
  return {
    zahler: zahler.length,
    topf: rows.reduce((sum: number, row: any) => sum + (row.abgabe ?? 0), 0),
    /**
     * Der Deckel BINDET, wenn die Abgabe genau auf ihm liegt. Hier stand zuerst
     * `row.gedeckelt` — ein Feld, das die Zeile gar nicht hat (`teamId, salary, rankShare,
     * ueberLinie1, ueberLinie2, rohAbgabe, deckel, abgabe, ausgleich, istEmpfaenger,
     * nettoDelta`). Der Zaehler stand deshalb ueberall auf 0 und behauptete, der Deckel greife
     * nie — ausgerechnet bei der Frage, die diese Messung beantworten soll.
     */
    amDeckel: zahler.filter((row: any) => row.deckel != null && Math.abs(row.abgabe - row.deckel) < 0.01).length,
  };
}

async function main() {
  const schwelle = argSchwelle();
  const persistence = createPersistenceService();

  console.log(`=== Der Hebel k(f): Rampe (Schwelle ${schwelle}) gegen Stufe ===`);
  const beobachtet = [0.82, 0.84, 0.87, 0.92, 0.96, 0.99, 1.03, 1.05, 1.08, 1.12, 1.19, 1.24];
  console.log(`  f       ${beobachtet.map((f) => f.toFixed(2).padStart(5)).join(" ")}`);
  console.log(
    `  Rampe   ${beobachtet.map((f) => r(apronKonjunkturhebel(f, schwelle), 2).toFixed(2).padStart(5)).join(" ")}`,
  );
  console.log(
    `  Stufe   ${beobachtet.map((f) => r(apronKonjunkturhebel(f, schwelle, schwelle), 2).toFixed(2).padStart(5)).join(" ")}`,
  );

  console.log("\n=== Topf je Spielstand: Rampe → Stufe ===");
  let summeRampe = 0;
  let summeStufe = 0;
  let beobachtungen = 0;
  for (const kopf of persistence.listSaves()) {
    const save = persistence.getSaveById(kopf.saveId);
    if (!save) continue;
    const gs = save.gameState;
    for (const [bezeichnung, faktor] of [
      ["laufend", resolveApronSalaryFactor(gs)],
      ["kommend", resolveApronSalaryFactorForNextSeason(gs)],
    ] as const) {
      try {
        const rampe = summe(abrechnung(gs, faktor, schwelle, false));
        const stufe = summe(abrechnung(gs, faktor, schwelle, true));
        summeRampe += rampe.topf;
        summeStufe += stufe.topf;
        beobachtungen += 1;
        const faktorAnteil = rampe.topf > 0.005 ? `x${r(stufe.topf / rampe.topf, 1)}` : stufe.topf > 0.005 ? "aus 0" : "—";
        console.log(
          `  ${kopf.saveId.slice(-6)} ${bezeichnung} f=${r(faktor, 2).toFixed(2)}  ` +
            `Rampe ${String(rampe.zahler).padStart(2)} Zahler / ${r(rampe.topf).toFixed(1).padStart(6)}  →  ` +
            `Stufe ${String(stufe.zahler).padStart(2)} Zahler / ${r(stufe.topf).toFixed(1).padStart(6)}  ` +
            `${faktorAnteil.padStart(6)}  (am Deckel ${rampe.amDeckel} → ${stufe.amDeckel})`,
        );
      } catch (error) {
        console.log(`  ${kopf.saveId.slice(-6)} ${bezeichnung}: FEHLER ${(error as Error).message}`);
      }
    }
  }
  console.log(
    `\n  Über ${beobachtungen} Beobachtungen: Topf gesamt ${r(summeRampe).toFixed(1)} → ${r(summeStufe).toFixed(1)}` +
      (summeRampe > 0.005 ? ` (x${r(summeStufe / summeRampe, 2)})` : ""),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
