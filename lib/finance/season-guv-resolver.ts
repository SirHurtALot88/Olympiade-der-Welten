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

import { getObjectiveCashByTeam } from "@/lib/board/objective-settlement-cash-source";
import type { GameState } from "@/lib/data/olyDataTypes";
import { buildApronProjection } from "@/lib/finance/apron-projection";
import { getApronCashByTeam } from "@/lib/finance/apron-settlement-cash-source";
import {
  buildSeasonGuv,
  computeFacilitySeasonCash,
  computeTeamLoanShares,
  type SeasonGuv,
  type SeasonGuvParts,
} from "@/lib/finance/season-end-guv";
import { getSeasonSponsorCashByTeam } from "@/lib/sponsor/sponsor-settlement-service";
import { getTeamActualSalaryTotal } from "@/lib/sponsor/sponsor-team-salary-display";

export type SeasonGuvResolveOptions = {
  /** Vorberechnete Sponsor-Abrechnung je Team (z. B. aus `getLeagueSponsorIncome`), spart die Vorschau. */
  sponsorCashByTeamId?: Map<string, number> | null;
  /** Transfer-Saldo je Team, sofern die aufrufende Ansicht ihn ohnehin hat. Abgrenzung, zählt nicht. */
  transferNetByTeamId?: Map<string, number> | null;
  /** Gehaltssumme je Team. Fehlt sie, wird sie aus den Rosterverträgen gebildet. */
  salaryTotalByTeamId?: Map<string, number> | null;
};

/**
 * Gehaltssumme je Team — DIESELBE Funktion, die auch abgebucht wird.
 *
 * VORHER stand hier `entry.salary` roh aus dem Roster. Das ist ein anderer Wert: bei geformten
 * Verträgen (`front_loaded`/`back_loaded`) trägt `yearlySalarySchedule[0]` die Rate DIESER Saison,
 * `entry.salary` dagegen das verhandelte Jahresmittel. Am Live-Abbild
 * (`new-game-1785823388048-1hf25q`, 340 Rosterverträge, davon 142 mit abweichendem Jahr 1) wichen
 * 27 von 32 Teams ab, bis zu 8,6 C je Team (Mayhem Mavericks 107,7 gebucht gegen 99,1 angezeigt).
 * Die Liga-Tabelle wies damit andere Kosten aus, als am Saisonende wirklich abgingen.
 */
function buildSalaryTotalByTeam(gameState: GameState): Map<string, number> {
  return new Map(gameState.teams.map((team) => [team.teamId, getTeamActualSalaryTotal(gameState, team.teamId)] as const));
}

/** Die Rohgrößen aller Teams — eine Beschaffung, danach nur noch Nachschlagen. */
export function resolveSeasonGuvPartsByTeam(
  gameState: GameState,
  options?: SeasonGuvResolveOptions,
): Map<string, SeasonGuvParts> {
  const sponsorCash = options?.sponsorCashByTeamId ?? getSeasonSponsorCashByTeam(gameState);
  const salaryTotals = options?.salaryTotalByTeamId ?? buildSalaryTotalByTeam(gameState);
  // Vorstandsziele: BELEG vor Nachrechnung. Sobald die Ziele gebucht sind, trägt
  // `objectiveRewardApplyLogs[].payload.cashDeltaByTeamId` genau die Aufteilung, mit der `team.cash`
  // fortgeschrieben wurde. Vorher rechnete diese Stelle bei jedem Aufruf neu — und weil mehrere
  // Ziele gegen den LEBENDEN Kontostand werten, wanderte die GuV-Zeile mit jeder späteren Buchung
  // (am Abbild `1hf25q` gemessen: 5 von 32 Teams wichen vom Beleg ab, bis zu 4,0 C).
  // Siehe `lib/board/objective-settlement-cash-source.ts`.
  const objectiveCash = getObjectiveCashByTeam(gameState);

  // Apron EINMAL für die ganze Liga: die Abrechnung ist ein Umverteilungstopf, ein einzelnes Team
  // lässt sich daraus gar nicht isoliert rechnen.
  const rankByTeamId = new Map<string, number | null>(
    gameState.teams.map((team) => [team.teamId, gameState.seasonState.standings?.[team.teamId]?.rank ?? null] as const),
  );
  // Apron: BELEG vor Nachrechnung — dieselbe Regel wie eine Zeile darüber bei den Vorstandszielen.
  // `gebucht` entscheidet, ob die Zeile in die GuV zaehlt (siehe `apronGebucht` in
  // season-end-guv.ts); ist sie gebucht, kommt auch der BETRAG aus dem Log statt aus der
  // Hochrechnung. Vorher entschied das Log nur ueber das Zaehlen, und der Betrag lief weiter mit
  // der Projektion mit — die gegen die Kader und Raenge von JETZT rechnet, nicht gegen die vom
  // Saisonende. Siehe `lib/finance/apron-settlement-cash-source.ts`.
  const apronCash = getApronCashByTeam(gameState);
  const apronGebucht = apronCash.gebucht;
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
      apronNetto: apronCash.gebucht ? (apronCash.byTeamId.get(team.teamId) ?? 0) : (apronRow?.nettoDelta ?? 0),
      apronRank: apronRow?.rank ?? null,
      apronFrozenLines: apron?.frozenLines ?? false,
      apronGedeckelt: apronRow?.gedeckelt ?? false,
      apronGebucht,
      objectiveCashDelta: objectiveCash.byTeamId.get(team.teamId) ?? 0,
      boardzieleGebucht: objectiveCash.gebucht && objectiveCash.quelle === "beleg",
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
