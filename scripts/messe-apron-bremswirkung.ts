/* eslint-disable no-console */
/**
 * WIE STARK WIRKT DIE APRON-BREMSE DER KI WIRKLICH?
 *
 * CHRIS: „aber was heißt kauft munter weiter? sollte der appetit nicht das kaufverhalten
 * beeinflussen? Können wir das messen wie sehr der bremsfaktor sich real auswirkt?"
 *
 * Berechtigt — „kauft munter weiter" war eine Behauptung, keine Messung. Der Faktor
 * (`resolveApronTighteningMultiplier`) verbietet nichts, er erhoeht die RUECKLAGE:
 *
 *     reserve = erwartetesGehalt x hoard x hoardTightening / apronTightening + maintenancePad
 *
 * Ein Faktor von 0,77 macht die Ruecklage also 1/0,77 = 1,30-mal so gross. Was das fuer das
 * KAUFBUDGET bedeutet, haengt daran, wie viel Cash das Team ueberhaupt hat — und an einem zweiten
 * Zweig direkt darunter, der die Ruecklage auf 45 % zusammenstreicht, sobald der Kader unter dem
 * Optimum liegt. Genau dieses Zusammenspiel misst dieses Skript, statt es zu vermuten.
 *
 * Aufruf:
 *   OLY_APP_SQLITE_PATH=<pfad> npx tsx scripts/messe-apron-bremswirkung.ts [--save <id>]
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import type { GameState } from "@/lib/data/olyDataTypes";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { getTeamApronSalaryBase, resolveSeasonApronLines } from "@/lib/season/apron-service";
import {
  resolveApronTighteningMultiplier,
  resolveTeamApronSalaryCeiling,
} from "@/lib/ai/ai-cash-salary-target-service";
import { resolveTeamCashRunwayReserve } from "@/lib/ai/ai-team-cash-reserve-service";
import { deriveRosterTargets } from "@/lib/foundation/roster-limits";

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
  const L = resolveSeasonApronLines(gs);
  console.log(`${kopf.saveId} · ${gs.season.id} · Linien ${r(L.line1)} / ${r(L.line2)} · Median ${r(L.medianSalary)}\n`);
  console.log("Team   Gehalt   Decke  Faktor |  Ruecklage MIT  OHNE   Delta | Cash  frei MIT  frei OHNE | Kader");

  let deltaSumme = 0;
  let freiVerlust = 0;
  const zeilen: string[] = [];
  for (const team of gs.teams) {
    const gehalt = getTeamApronSalaryBase(gs, team.teamId);
    const decke = resolveTeamApronSalaryCeiling(gs, team.teamId);
    if (gehalt <= decke) continue;
    const faktor = resolveApronTighteningMultiplier(gs, team.teamId);
    const mit = resolveTeamCashRunwayReserve(gs, team.teamId);
    /**
     * „OHNE Bremse" wird NICHT nachgebaut, sondern aus derselben Funktion gewonnen: die Ruecklage
     * haengt linear an `1 / apronTightening`, ein Faktor von 1 ergibt also `mit * faktor`. So bleibt
     * es eine Rechenstelle — ein zweiter Nachbau der Formel wuerde beim naechsten Umbau abweichen.
     * Der Sockel `maintenancePad` faellt dabei minimal mit heraus; er ist gegen die Gehaltssumme
     * klein und die Aussage (wie viel Cash die Bremse bindet) haengt nicht an ihm.
     */
    const ohne = mit * faktor;
    const cash = Number((team as { cash?: number }).cash ?? 0);
    const freiMit = Math.max(0, cash - mit);
    const freiOhne = Math.max(0, cash - ohne);
    const identity = gs.teamIdentities.find((e) => e.teamId === team.teamId);
    const ziele = deriveRosterTargets(team, identity);
    const kader = gs.rosters.filter((e) => e.teamId === team.teamId).length;
    deltaSumme += mit - ohne;
    freiVerlust += freiOhne - freiMit;
    zeilen.push(
      `${team.teamId.padEnd(6)} ${r(gehalt).padStart(6)} ${r(decke).padStart(7)} ${r(faktor, 2).padStart(7)} |` +
        `${r(mit).padStart(15)} ${r(ohne).padStart(5)} ${r(mit - ohne).padStart(7)} |` +
        `${r(cash).padStart(6)} ${r(freiMit).padStart(9)} ${r(freiOhne).padStart(10)} | ` +
        `${kader}/${ziele.playerOpt}${kader < ziele.playerOpt ? " (unter Opt → Ruecklage x0,45)" : ""}`,
    );
  }
  console.log(zeilen.join("\n"));
  console.log(
    `\n  Die Bremse bindet zusaetzlich ${r(deltaSumme)} Cash ueber ${zeilen.length} Teams — ` +
      `davon real verfuegbar gewesen: ${r(freiVerlust)}.`,
  );
  console.log(
    "  Stehen bei einem Team beide Frei-Spalten auf 0, hatte es ohnehin kein Kaufbudget: die Bremse\n" +
      "  aendert dort nichts, weil sie an einer Ruecklage dreht, die das Cash bereits uebersteigt.",
  );
}

main();
