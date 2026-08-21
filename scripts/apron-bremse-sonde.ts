/* eslint-disable no-console */
/**
 * SONDE: was die Apron-Bremse GENAU IN DEM MOMENT bindet, in dem die KI kauft.
 *
 * CHRIS: „sollte der appetit nicht das kaufverhalten beeinflussen? Können wir das messen wie sehr
 * der bremsfaktor sich real auswirkt?"
 *
 * Bisher habe ich diese Frage zweimal am falschen Stand gemessen — mitten in der Saison (da hat
 * ohnehin niemand freies Budget) und am `season_completed`-Stand (da stand kein einziges Team über
 * seiner Decke). Beide Male kam „bindet nichts" heraus, und beide Male sagte das nichts über den
 * KAUFMOMENT. Der liegt in der Vorsaison, unmittelbar vor `runTransferWindowSession`.
 *
 * Diese Sonde hängt sich genau dort ein. Sie ändert nichts, sie schreibt nur mit — je Team:
 * Gehalt, Decke, Bremsfaktor, Rücklage MIT und OHNE Bremse (beides aus
 * `resolveTeamCashRunwayReserve`, siehe `apronBremseAus` dort) und daraus das freie Kaufbudget
 * MIT und OHNE. Die Differenz der freien Budgets ist die Antwort: das ist das Geld, das die Bremse
 * dem Team im Kaufmoment real aus der Hand nimmt.
 *
 * Eingeschaltet über `OLY_MESS_APRON_BREMSE=<pfad.jsonl>`; ohne die Variable passiert nichts.
 */
import fs from "node:fs";

import type { GameState } from "@/lib/data/olyDataTypes";
import { getTeamApronSalaryBase, resolveSeasonApronLines } from "@/lib/season/apron-service";
import {
  resolveApronTighteningMultiplier,
  resolveTeamApronSalaryCeiling,
} from "@/lib/ai/ai-cash-salary-target-service";
import { resolveTeamCashRunwayReserve } from "@/lib/ai/ai-team-cash-reserve-service";
import { deriveRosterTargets } from "@/lib/foundation/roster-limits";

export type ApronBremsZeile = {
  seasonId: string;
  phase: string;
  teamId: string;
  kuerzel: string;
  gehalt: number;
  decke: number;
  faktor: number;
  linie1: number;
  linie2: number;
  median: number;
  cash: number;
  kader: number;
  kaderOpt: number;
  ruecklageMit: number;
  ruecklageOhne: number;
  freiMit: number;
  freiOhne: number;
};

function r2(x: number): number {
  return Number.isFinite(x) ? Math.round(x * 100) / 100 : 0;
}

export function erhebeApronBremsZeilen(gameState: GameState, seasonId: string, phase: string): ApronBremsZeile[] {
  const linien = resolveSeasonApronLines(gameState);
  return gameState.teams.map((team) => {
    const identity = gameState.teamIdentities.find((entry) => entry.teamId === team.teamId);
    const { playerOpt } = deriveRosterTargets(team, identity);
    const ruecklageMit = resolveTeamCashRunwayReserve(gameState, team.teamId);
    const ruecklageOhne = resolveTeamCashRunwayReserve(gameState, team.teamId, { apronBremseAus: true });
    const cash = team.cash ?? 0;
    return {
      seasonId,
      phase,
      teamId: team.teamId,
      kuerzel: team.shortCode ?? team.teamId,
      gehalt: r2(getTeamApronSalaryBase(gameState, team.teamId)),
      decke: r2(resolveTeamApronSalaryCeiling(gameState, team.teamId)),
      faktor: r2(resolveApronTighteningMultiplier(gameState, team.teamId)),
      linie1: r2(linien.line1),
      linie2: r2(linien.line2),
      median: r2(linien.medianSalary),
      cash: r2(cash),
      kader: gameState.rosters.filter((entry) => entry.teamId === team.teamId).length,
      kaderOpt: playerOpt,
      ruecklageMit: r2(ruecklageMit),
      ruecklageOhne: r2(ruecklageOhne),
      freiMit: r2(Math.max(0, cash - ruecklageMit)),
      freiOhne: r2(Math.max(0, cash - ruecklageOhne)),
    };
  });
}

/** Schreibt die Sonde, wenn `OLY_MESS_APRON_BREMSE` gesetzt ist — sonst ein No-op. */
export function schreibeApronBremsSonde(gameState: GameState, seasonId: string, phase: string): void {
  const ziel = process.env.OLY_MESS_APRON_BREMSE;
  if (!ziel) return;
  const zeilen = erhebeApronBremsZeilen(gameState, seasonId, phase);
  fs.appendFileSync(ziel, zeilen.map((zeile) => JSON.stringify(zeile)).join("\n") + "\n", "utf-8");
  const ueber = zeilen.filter((zeile) => zeile.faktor < 1);
  const entzogen = zeilen.reduce((sum, zeile) => sum + Math.max(0, zeile.freiOhne - zeile.freiMit), 0);
  console.error(
    `[apron-sonde] ${seasonId}/${phase}: ${ueber.length}/${zeilen.length} ueber Decke, entzogenes freies Budget ${r2(entzogen)}`,
  );
}
