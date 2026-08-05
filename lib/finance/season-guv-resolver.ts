/**
 * Beschafft die Rohgrößen der EINEN GuV (siehe `season-end-guv.ts`) für die ganze Liga — einmal pro
 * Spielstand, nicht einmal pro Ansicht.
 *
 * WARUM EINE EIGENE DATEI. `season-end-guv.ts` ist bewusst frei von Sponsor-Importen: die
 * Sponsor-Vorschau (`previewSponsorSettlement`) ruft ihrerseits `buildTeamSeasonOverviewRows` auf —
 * einmal pro Team mit Vertrag, plus zwei weitere Male in der Achsen-/Sonderziel-Auswertung. Zöge die
 * GuV-Rechnung diesen Aufruf mit, hinge er an jeder Tabellenzeile, und die Saisonstand-Übersicht
 * würde sich selbst rekursiv anstoßen. Deshalb liegt die teure Beschaffung hier, wird EINMAL für die
 * Liga gemacht und in eine Map gelegt; die Verbraucher lesen nur noch nach.
 *
 * WICHTIG FÜR AUFRUFER: aus `buildTeamSeasonOverviewRows` heraus darf diese Datei NICHT aufgerufen
 * werden — genau das wäre der Zyklus. Die Saisonstand-Übersicht bekommt ihre GuV über den Feed
 * (`standingsByTeamId`), nicht über einen eigenen Aufruf.
 */

import { buildTeamSeasonObjectiveSettlement } from "@/lib/board/team-season-objectives-service";
import type { GameState } from "@/lib/data/olyDataTypes";
import { buildApronProjection } from "@/lib/finance/apron-projection";
import {
  buildSeasonGuv,
  computeFacilitySeasonCash,
  computeTeamLoanShares,
  type SeasonGuv,
  type SeasonGuvParts,
} from "@/lib/finance/season-end-guv";
import { getTeamSponsorContract } from "@/lib/sponsor/sponsor-offer-read";
import { previewSponsorSettlement } from "@/lib/sponsor/sponsor-settlement-service";

/**
 * Sponsor-Abrechnung beim aktuellen Rang je Team. Vorzeichenecht summiert und nur für Teams MIT
 * Vertrag — exakt wie der Apply (`sponsor-settlement-service`). Negative Zeilen (verfehlte Achse,
 * Vorschuss-Verrechnung) gehören dazu; sie wegzufiltern hätte die Einnahme geschönt.
 */
function buildSponsorCashByTeam(gameState: GameState): Map<string, number> {
  const byTeam = new Map<string, number>();
  const contracted = new Set(
    gameState.teams.filter((team) => getTeamSponsorContract(gameState, team.teamId)).map((team) => team.teamId),
  );
  try {
    for (const row of previewSponsorSettlement(gameState).rows) {
      if (!contracted.has(row.teamId)) continue;
      byTeam.set(row.teamId, (byTeam.get(row.teamId) ?? 0) + row.cashDelta);
    }
  } catch {
    // Ohne Verträge gibt es keine Vorschau — die Sponsor-Zeile steht dann bei 0 und sagt das auch.
  }
  return byTeam;
}

export type SeasonGuvResolveOptions = {
  /** Vorberechnete Sponsor-Abrechnung je Team (z. B. aus `getLeagueSponsorIncome`), spart die Vorschau. */
  sponsorCashByTeamId?: Map<string, number> | null;
  /** Transfer-Saldo je Team, sofern die aufrufende Ansicht ihn ohnehin hat. Abgrenzung, zählt nicht. */
  transferNetByTeamId?: Map<string, number> | null;
  /** Gehaltssumme je Team. Fehlt sie, wird sie aus den Rosterverträgen gebildet. */
  salaryTotalByTeamId?: Map<string, number> | null;
};

function buildSalaryTotalByTeam(gameState: GameState): Map<string, number> {
  const byTeam = new Map<string, number>();
  for (const entry of gameState.rosters) {
    byTeam.set(entry.teamId, (byTeam.get(entry.teamId) ?? 0) + (entry.salary ?? 0));
  }
  return byTeam;
}

/** Die Rohgrößen aller Teams — eine Beschaffung, danach nur noch Nachschlagen. */
export function resolveSeasonGuvPartsByTeam(
  gameState: GameState,
  options?: SeasonGuvResolveOptions,
): Map<string, SeasonGuvParts> {
  const sponsorCash = options?.sponsorCashByTeamId ?? buildSponsorCashByTeam(gameState);
  const salaryTotals = options?.salaryTotalByTeamId ?? buildSalaryTotalByTeam(gameState);
  const objectiveSettlement = (() => {
    try {
      return buildTeamSeasonObjectiveSettlement(gameState).byTeamId;
    } catch {
      return {} as Record<string, { cashDelta?: number }>;
    }
  })();

  // Apron EINMAL für die ganze Liga: die Abrechnung ist ein Umverteilungstopf, ein einzelnes Team
  // lässt sich daraus gar nicht isoliert rechnen.
  const rankByTeamId = new Map<string, number | null>(
    gameState.teams.map((team) => [team.teamId, gameState.seasonState.standings?.[team.teamId]?.rank ?? null] as const),
  );
  const apron = (() => {
    try {
      return buildApronProjection({ gameState, rankByTeamId });
    } catch {
      return null;
    }
  })();

  const byTeam = new Map<string, SeasonGuvParts>();
  for (const team of gameState.teams) {
    const facilities = computeFacilitySeasonCash(gameState, team.teamId, team.cash);
    const loans = computeTeamLoanShares(gameState, team.teamId);
    const apronRow = apron?.byTeamId.get(team.teamId) ?? null;
    byTeam.set(team.teamId, {
      teamId: team.teamId,
      sponsorCash: sponsorCash.get(team.teamId) ?? 0,
      facilityIncome: facilities.income,
      facilityUpkeep: facilities.paidUpkeep,
      apronNetto: apronRow?.nettoDelta ?? 0,
      apronRank: apronRow?.rank ?? null,
      apronFrozenLines: apron?.frozenLines ?? false,
      apronGedeckelt: apronRow?.gedeckelt ?? false,
      objectiveCashDelta: objectiveSettlement[team.teamId]?.cashDelta ?? 0,
      salaryTotal: salaryTotals.get(team.teamId) ?? 0,
      loanInterest: loans.interest,
      loanPrincipal: loans.principal,
      transferNet: options?.transferNetByTeamId?.get(team.teamId) ?? 0,
    });
  }
  return byTeam;
}

/** Die fertige GuV aller Teams. */
export function resolveSeasonGuvByTeam(gameState: GameState, options?: SeasonGuvResolveOptions): Map<string, SeasonGuv> {
  const parts = resolveSeasonGuvPartsByTeam(gameState, options);
  return new Map([...parts.entries()].map(([teamId, entry]) => [teamId, buildSeasonGuv(entry)] as const));
}

/** Die GuV eines einzelnen Teams. Für eine ganze Tabelle die Map-Variante nehmen. */
export function resolveSeasonGuvForTeam(
  gameState: GameState,
  teamId: string,
  options?: SeasonGuvResolveOptions,
): SeasonGuv | null {
  return resolveSeasonGuvByTeam(gameState, options).get(teamId) ?? null;
}
