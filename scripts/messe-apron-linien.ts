/* eslint-disable no-console */
/**
 * WIE HOCH LIEGEN DIE APRON-LINIEN WIRKLICH — und wen fangen sie?
 *
 * CHRIS: „moment warum sind die apron linien die du angibst so gering? müssten die nicht höher
 * liegen? das 67 für 2. apron ist super gering und 59 für 1. bitte noch mal prüfen! die aprons waren
 * doch 1,125 und 1,25 über mediangehalt oder sollten sie sein, wenn dann sowas krasses raus kommt
 * müssen wir die apron faktoren einfach anheben"
 *
 * Gerechnet wird über die ECHTEN Produktionsfunktionen (`computeApronLines`,
 * `getTeamApronSalaryBase`). Dieses Skript baut keine zweite Definition, es zeigt die vorhandene.
 *
 * Aufruf:
 *   OLY_APP_SQLITE_PATH=<pfad> npx tsx scripts/messe-apron-linien.ts [--faktoren 1.1,1.25 1.3,1.5 ...]
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import type { GameState } from "@/lib/data/olyDataTypes";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import {
  APRON_LINE_1_MEDIAN_FACTOR,
  APRON_LINE_2_MEDIAN_FACTOR,
  computeApronLines,
  getTeamApronSalaryBase,
  resolveSeasonApronLines,
} from "@/lib/season/apron-service";

function r(value: number, stellen = 1): number {
  const f = 10 ** stellen;
  return Math.round(value * f) / f;
}

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? ((s[m - 1] ?? 0) + (s[m] ?? 0)) / 2 : (s[m] ?? 0);
}

function quantil(values: readonly number[], anteil: number): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.round(anteil * (s.length - 1))))] ?? 0;
}

/** Faktorpaare aus der Kommandozeile, sonst die heutigen plus drei Anhebungen zum Vergleich. */
function argFaktoren(): Array<[number, number]> {
  const argv = process.argv.slice(2);
  const i = argv.indexOf("--faktoren");
  const roh = i >= 0 ? argv.slice(i + 1) : ["1.1,1.25", "1.125,1.25", "1.2,1.4", "1.3,1.6", "1.5,2.0"];
  return roh
    .map((paar) => paar.split(",").map((x) => Number(x.trim())))
    .filter((p) => p.length === 2 && p.every((n) => Number.isFinite(n)))
    .map((p) => [p[0]!, p[1]!] as [number, number]);
}

async function main() {
  const faktoren = argFaktoren();
  const persistence = createPersistenceService();

  for (const kopf of persistence.listSaves()) {
    const save = persistence.getSaveById(kopf.saveId);
    if (!save) continue;
    const gs = save.gameState as GameState;
    const gehaelter = gs.teams.map((team) => getTeamApronSalaryBase(gs, team.teamId)).filter((x) => x > 0);
    if (gehaelter.length === 0) continue;

    const med = median(gehaelter);
    const berechnet = computeApronLines(gs);
    const eingefroren = resolveSeasonApronLines(gs);
    const hoechstes = Math.max(...gehaelter);

    console.log(`\n=== ${kopf.saveId.slice(-6)} · ${gs.season.id} · ${gehaelter.length} Teams`);
    console.log(
      `  Gehaelter: min ${r(Math.min(...gehaelter))} · p25 ${r(quantil(gehaelter, 0.25))} · MEDIAN ${r(med)} · ` +
        `p75 ${r(quantil(gehaelter, 0.75))} · max ${r(hoechstes)}   (Spitze = ${r(hoechstes / med, 2)} x Median)`,
    );
    console.log(
      `  Linien heute (${APRON_LINE_1_MEDIAN_FACTOR} / ${APRON_LINE_2_MEDIAN_FACTOR}): ` +
        `L1 ${r(berechnet.line1)} · L2 ${r(berechnet.line2)}` +
        (eingefroren && Math.abs(eingefroren.line1 - berechnet.line1) > 0.05
          ? `   [eingefroren: L1 ${r(eingefroren.line1)} · L2 ${r(eingefroren.line2)}]`
          : ""),
    );
    console.log("  Faktorpaar     L1      L2   |  ueber L1  ueber L2   groesster Ueberschuss");
    for (const [f1, f2] of faktoren) {
      const l1 = med * f1;
      const l2 = med * f2;
      const ueber1 = gehaelter.filter((g) => g > l1).length;
      const ueber2 = gehaelter.filter((g) => g > l2).length;
      const maxUeberschuss = Math.max(0, hoechstes - l2);
      const heute = f1 === APRON_LINE_1_MEDIAN_FACTOR && f2 === APRON_LINE_2_MEDIAN_FACTOR ? "  ← heute" : "";
      console.log(
        `  ${f1.toFixed(3)}/${f2.toFixed(2)}  ${r(l1).toFixed(1).padStart(6)}  ${r(l2).toFixed(1).padStart(6)}   |` +
          `${String(ueber1).padStart(9)}${String(ueber2).padStart(10)}   ${r(maxUeberschuss).toFixed(1).padStart(9)}${heute}`,
      );
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
