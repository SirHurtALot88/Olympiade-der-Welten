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
 * DER ZEITPUNKT ENTSCHEIDET. Dieses Skript misst EINEN Stand. Mitten in der Saison hat ohnehin
 * kaum ein Team freies Budget, am `season_completed`-Stand steht kaum ein Team ueber seiner Decke
 * (die Vertraege sind gerade ausgelaufen) — beide Male kommt „bindet nichts" heraus, und beide Male
 * sagt das nichts ueber den KAUFMOMENT. Der liegt in der Vorsaison, unmittelbar vor dem
 * Kaufdurchlauf; dort misst `scripts/apron-bremse-sonde.ts` waehrend eines Simulationslaufs.
 *
 * Aufruf:
 *   OLY_APP_SQLITE_PATH=<pfad> npx tsx scripts/messe-apron-bremswirkung.ts [--save <id>]
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import type { GameState } from "@/lib/data/olyDataTypes";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { resolveSeasonApronLines } from "@/lib/season/apron-service";
import { erhebeApronBremsZeilen } from "./apron-bremse-sonde";

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
  for (const zeile of erhebeApronBremsZeilen(gs, gs.season.id, "einzelstand")) {
    if (zeile.faktor >= 1) continue;
    deltaSumme += zeile.ruecklageMit - zeile.ruecklageOhne;
    freiVerlust += zeile.freiOhne - zeile.freiMit;
    zeilen.push(
      `${zeile.teamId.padEnd(6)} ${r(zeile.gehalt).padStart(6)} ${r(zeile.decke).padStart(7)} ${r(zeile.faktor, 2).padStart(7)} |` +
        `${r(zeile.ruecklageMit).padStart(15)} ${r(zeile.ruecklageOhne).padStart(5)} ${r(zeile.ruecklageMit - zeile.ruecklageOhne).padStart(7)} |` +
        `${r(zeile.cash).padStart(6)} ${r(zeile.freiMit).padStart(9)} ${r(zeile.freiOhne).padStart(10)} | ` +
        `${zeile.kader}/${zeile.kaderOpt}${zeile.kader < zeile.kaderOpt ? " (unter Opt \u2192 Ruecklage x0,45)" : ""}`,
    );
  }
  console.log(zeilen.join("\n"));
  console.log(
    `\n  Die Bremse bindet zusaetzlich ${r(deltaSumme)} Cash ueber ${zeilen.length} Teams \u2014 ` +
      `davon real verfuegbar gewesen: ${r(freiVerlust)}.`,
  );
  console.log(
    "  Stehen bei einem Team beide Frei-Spalten auf 0, hatte es ohnehin kein Kaufbudget: die Bremse\n" +
      "  aendert dort nichts, weil sie an einer Ruecklage dreht, die das Cash bereits uebersteigt.",
  );
}

main();
