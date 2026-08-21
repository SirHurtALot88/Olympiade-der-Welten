/* eslint-disable no-console */
/**
 * WIE WEIT SIND DIE TEAMS UEBER DEN LINIEN — und was kostet sie das?
 *
 * CHRIS: „müssen wir den hebel denn erhöhen? wie viel sind die teams denn über dem 2. apron drüber?
 * da würde ich es schon krasser machen dass die teams drauf gucken den nicht zu hart zu
 * überschreiten, der erste ist ja noch ‚ok'."
 *
 * Die berechtigte Vorfrage vor jeder Faktor- oder Satzentscheidung. Dieses Skript misst die
 * VERTEILUNG der Ueberschreitung an einem Spielstand: je Team die Apron-Basis, den Abstand zu
 * beiden Linien und die Abgabe, die daraus faellt.
 *
 * ZONE 2 IST DIE INTERESSANTE. Besteuert wird der Ueberschuss zonenweise (`apronLevyForSalary`):
 * der Teil zwischen Linie 1 und Linie 2 zum ersten Satz, alles ueber Linie 2 zum zweiten. Wenn in
 * Zone 2 kaum jemand steht, ist der zweite Satz eine Zahl ohne Wirkung — egal wie hoch er ist.
 *
 * Der Vergleichssatz `--satz2 <zahl>` rechnet dieselbe Verteilung mit einem anderen zweiten Satz
 * durch, ohne etwas zu aendern.
 *
 * `--faktoren <f1>,<f2>` rechnet dieselben Kader gegen ANDERE Linien durch — noetig, sobald ein
 * Spielstand eingefrorene Linien aus einer aelteren Faktor-Generation traegt (Chris' Save vom
 * 19.08. steht auf 1,099/1,25, die Regel heute auf 1,25/1,6). Ohne das vergleicht man denselben
 * Kader gegen zwei verschiedene Steuern und haelt den Unterschied fuer eine Aussage ueber die Liga.
 *
 * Aufruf:
 *   OLY_APP_SQLITE_PATH=<pfad> npx tsx scripts/messe-apron-ueberschreitung.ts [--save <id>] [--satz2 2.4] [--faktoren 1.25,1.6]
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import type { GameState } from "@/lib/data/olyDataTypes";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import {
  APRON_RATE_ZONE_1,
  APRON_RATE_ZONE_2,
  APRON_LINE_1_MEDIAN_FACTOR,
  APRON_LINE_2_MEDIAN_FACTOR,
  apronLevyForSalary,
  areSeasonApronLinesFrozen,
  getTeamApronSalaryBase,
  resolveApronSalaryFactor,
  resolveSeasonApronLines,
} from "@/lib/season/apron-service";

function r(x: number, d = 1): string {
  return Number.isFinite(x) ? (Math.round(x * 10 ** d) / 10 ** d).toFixed(d) : "—";
}

function argValue(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i >= 0 ? (process.argv[i + 1] ?? null) : null;
}

function main(): void {
  const persistence = createPersistenceService();
  const id = argValue("--save");
  const kopf = id ? persistence.getSaveById(id) : persistence.getActiveSave();
  if (!kopf?.gameState) throw new Error("Kein Spielstand gefunden.");
  const gs = kopf.gameState as GameState;
  const gemessen = resolveSeasonApronLines(gs);
  const faktorenArg = argValue("--faktoren");
  const linien = faktorenArg
    ? (() => {
        const [f1, f2] = faktorenArg.split(",").map(Number);
        return {
          ...gemessen,
          line1: gemessen.medianSalary * (f1 ?? APRON_LINE_1_MEDIAN_FACTOR),
          line2: gemessen.medianSalary * (f2 ?? APRON_LINE_2_MEDIAN_FACTOR),
        };
      })()
    : gemessen;
  const faktor = resolveApronSalaryFactor(gs);
  const satz2 = Number(argValue("--satz2") ?? APRON_RATE_ZONE_2);

  console.log(
    `${kopf.saveId} · ${gs.season.id} · Linien ${r(linien.line1)} / ${r(linien.line2)} ` +
      `(Median ${r(linien.medianSalary)}, eingefroren: ${areSeasonApronLinesFrozen(gs) ? "ja" : "nein"}) ` +
      `· Saison-Faktor ${r(faktor, 2)}`,
  );
  const snapFaktoren =
    linien.medianSalary > 0 ? `${r(linien.line1 / linien.medianSalary, 3)} / ${r(linien.line2 / linien.medianSalary, 3)}` : "—";
  console.log(
    `Faktoren dieses Standes: ${snapFaktoren} · heutige Regel: ${APRON_LINE_1_MEDIAN_FACTOR} / ${APRON_LINE_2_MEDIAN_FACTOR}`,
  );
  console.log(`Saetze: Zone 1 ${APRON_RATE_ZONE_1} · Zone 2 ${APRON_RATE_ZONE_2}${satz2 !== APRON_RATE_ZONE_2 ? ` (Vergleich: ${satz2})` : ""}\n`);

  const zeilen = gs.teams
    .map((team) => {
      const salary = getTeamApronSalaryBase(gs, team.teamId);
      const inZone1 = Math.max(0, Math.min(salary, linien.line2) - linien.line1);
      const inZone2 = Math.max(0, salary - linien.line2);
      return {
        kuerzel: team.shortCode ?? team.teamId,
        salary,
        inZone1,
        inZone2,
        ueberL2Prozent: linien.line2 > 0 ? (salary / linien.line2 - 1) * 100 : 0,
        abgabe: apronLevyForSalary({ salary, line1: linien.line1, line2: linien.line2, salaryFactor: faktor }),
        abgabeVergleich: apronLevyForSalary({
          salary,
          line1: linien.line1,
          line2: linien.line2,
          salaryFactor: faktor,
          rateZone2: satz2,
        }),
      };
    })
    .sort((a, b) => b.salary - a.salary);

  const inZone1 = zeilen.filter((z) => z.inZone1 > 0);
  const inZone2 = zeilen.filter((z) => z.inZone2 > 0);

  console.log("Team   Gehalt | ueber L1 | ueber L2 | % ueber L2 | Abgabe | Abgabe(Vergleich)");
  for (const z of zeilen.filter((entry) => entry.inZone1 > 0 || entry.inZone2 > 0)) {
    console.log(
      `${z.kuerzel.padEnd(6)} ${r(z.salary).padStart(6)} |` +
        `${r(z.inZone1).padStart(9)} |${r(z.inZone2).padStart(9)} |` +
        `${r(z.ueberL2Prozent).padStart(10)}% |${r(z.abgabe, 2).padStart(7)} |${r(z.abgabeVergleich, 2).padStart(18)}`,
    );
  }

  const summe = (xs: number[]) => xs.reduce((sum, x) => sum + x, 0);
  console.log(
    `\n  In Zone 1 (zwischen den Linien): ${inZone1.length} Teams, zusammen ${r(summe(inZone1.map((z) => z.inZone1)))} ueber Linie 1.`,
  );
  console.log(
    `  In Zone 2 (ueber der 2. Linie):  ${inZone2.length} Teams, zusammen ${r(summe(inZone2.map((z) => z.inZone2)))} ueber Linie 2.`,
  );
  if (inZone2.length > 0) {
    const prozente = inZone2.map((z) => z.ueberL2Prozent).sort((a, b) => a - b);
    console.log(
      `  Ueberschreitung der 2. Linie: von ${r(prozente[0] ?? 0)} % bis ${r(prozente[prozente.length - 1] ?? 0)} %.`,
    );
  }
  console.log(
    `  Topf: ${r(summe(zeilen.map((z) => z.abgabe)))}` +
      (satz2 !== APRON_RATE_ZONE_2 ? ` · mit Satz 2 = ${satz2}: ${r(summe(zeilen.map((z) => z.abgabeVergleich)))}` : ""),
  );
  console.log(
    "\n  LESEHILFE: steht in Zone 2 niemand, ist der zweite Satz wirkungslos — dann entscheidet nicht\n" +
      "  der Satz, sondern wo die 2. Linie liegt.",
  );
}

main();
