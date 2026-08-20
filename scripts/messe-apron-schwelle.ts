/* eslint-disable no-console */
/**
 * APRON-SCHWELLE DURCHMESSEN — was ändert sich, wenn der Konjunkturhebel früher greift?
 *
 * Chris' Entscheidung zu `6fv43h`, Weg 1 von dreien: „mach 1" — die Schwelle senken.
 *
 * Gerechnet wird über die ECHTEN Produktionsfunktionen (`computeApronLines`,
 * `computeApronSettlement` mit dem Kalibrier-Override `konjunkturFactorMin`); dieses Skript baut
 * KEINE zweite Abgaben-Formel, es füttert nur eine andere Schwelle hinein.
 *
 * Aufruf:
 *   OLY_APP_SQLITE_PATH=<pfad> npx tsx scripts/messe-apron-schwelle.ts [--schwellen 0.95,0.88,0.82]
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import type { GameState } from "@/lib/data/olyDataTypes";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import {
  APRON_KONJUNKTUR_FACTOR_MAX,
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

function argSchwellen(): number[] {
  const argv = process.argv.slice(2);
  const i = argv.indexOf("--schwellen");
  const roh = i >= 0 ? argv[i + 1] : "0.95,0.92,0.88,0.85,0.82";
  return roh.split(",").map((s) => Number(s.trim())).filter((n) => Number.isFinite(n));
}

/** Endrang je Team aus dem Saisonstand — für den Deckel (Wertungsanteil). */
function raengeAusStand(gameState: GameState): Map<string, number> {
  const standings = (gameState.seasonState?.standings ?? {}) as Record<string, { points?: number }>;
  const sortiert = Object.entries(standings)
    .map(([teamId, row]) => ({ teamId, punkte: row?.points ?? 0 }))
    .sort((a, b) => b.punkte - a.punkte || a.teamId.localeCompare(b.teamId));
  const raenge = new Map<string, number>();
  sortiert.forEach((row, index) => raenge.set(row.teamId, index + 1));
  return raenge;
}

function abrechnung(gameState: GameState, salaryFactor: number, schwelle: number) {
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
  });
}

async function main() {
  const schwellen = argSchwellen();
  const persistence = createPersistenceService();

  console.log("=== Der Hebel k(f) je Schwelle, über die real beobachteten Salary Factors ===");
  const beobachtet = [0.82, 0.84, 0.87, 0.92, 0.96, 0.99, 1.03, 1.05, 1.08, 1.12, 1.19, 1.24];
  console.log(`  f          ${beobachtet.map((f) => f.toFixed(2).padStart(5)).join(" ")}`);
  for (const schwelle of schwellen) {
    const werte = beobachtet.map((f) => apronKonjunkturhebel(f, schwelle));
    const nullen = werte.filter((k) => k <= 0).length;
    console.log(
      `  min=${schwelle.toFixed(2)}  ${werte.map((k) => r(k, 2).toFixed(2).padStart(5)).join(" ")}   ` +
        `k=0 in ${nullen}/${beobachtet.length}`,
    );
  }
  console.log(`  (Vollwirkung unverändert bei f >= ${APRON_KONJUNKTUR_FACTOR_MAX})`);

  console.log("\n=== Zahler und Topf je Spielstand, laufende und kommende Saison ===");
  for (const kopf of persistence.listSaves()) {
    const save = persistence.getSaveById(kopf.saveId);
    if (!save) continue;
    const gs = save.gameState;
    for (const [bezeichnung, faktor] of [
      ["laufend ", resolveApronSalaryFactor(gs)],
      ["kommend ", resolveApronSalaryFactorForNextSeason(gs)],
    ] as const) {
      const zeilen: string[] = [];
      for (const schwelle of schwellen) {
        try {
          const s: any = abrechnung(gs, faktor, schwelle);
          const zahler = (s.rows ?? s.teams ?? []).filter((row: any) => (row.abgabe ?? 0) > 0.005).length;
          const topf = (s.rows ?? s.teams ?? []).reduce((sum: number, row: any) => sum + (row.abgabe ?? 0), 0);
          zeilen.push(`min=${schwelle.toFixed(2)}: ${String(zahler).padStart(2)} Zahler / Topf ${r(topf).toFixed(1)}`);
        } catch (error) {
          zeilen.push(`min=${schwelle.toFixed(2)}: FEHLER ${(error as Error).message}`);
        }
      }
      console.log(`  ${kopf.saveId.slice(-6)} ${bezeichnung} f=${r(faktor, 2)}   ${zeilen.join("  |  ")}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
