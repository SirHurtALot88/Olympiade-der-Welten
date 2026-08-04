"use client";

import { useMemo } from "react";

import type { GameState } from "@/lib/data/olyDataTypes";
import { buildTeamOperatingGuv } from "@/lib/finance/operating-guv";
import { roundValue as round1 } from "@/lib/foundation/foundation-number-utils";
import { buildTeamSeasonOverviewRows } from "@/lib/foundation/team-management-overview";
import type {
  FinancePrizeIncome,
  FinanceSeasonHistoryPoint,
  FinancesViewModel,
  TeamFinancesState,
} from "@/lib/foundation/finances/finances-types";

/**
 * Wie viele vergangene (archivierte) Saisons der GuV-/Cash-Verlauf zusätzlich zur laufenden Saison
 * zeigt (T-107).
 */
const HISTORY_PAST_SEASONS = 4;

/**
 * Builds the Finanzen view model for one human team's current-season income/expense breakdown.
 * Client-safe (no fs/better-sqlite3 imports).
 *
 * DIE GUV SELBST WIRD HIER NICHT MEHR GERECHNET. Sie kommt aus `lib/finance/operating-guv.ts` —
 * derselben Datei, aus der auch die Spalte „GuV" im Saisonstand ihre Zahl liest. Vorher stand die
 * Rechnung hier, und der Saisonstand hatte eine zweite, schmalere (ohne Vorstandsziele, ohne
 * Kreditzinsen, mit Brutto- statt bezahltem Gebäude-Unterhalt); das war Ticket 24. Wer hier etwas
 * an der GuV ändern will, ändert es dort — sonst gibt es die zwei Zahlen wieder.
 *
 * Fog of war: this must only ever be called with the ACTIVE MANAGER's own team id
 * (`activeManagerTeamId`), same as `buildCreditsViewModel`. Never pass another team's id in here.
 */
export function buildFinancesViewModel(gameState: GameState, teamId: string | null): FinancesViewModel {
  if (!teamId) {
    return { status: "not_ready" };
  }

  const team = gameState.teams.find((candidate) => candidate.teamId === teamId);
  if (!team) {
    return { status: "not_ready" };
  }

  const operating = buildTeamOperatingGuv(gameState, teamId);
  if (!operating) {
    return { status: "not_ready" };
  }

  // --- Preisgeld (Liga-Pool) ---------------------------------------------
  // LEGACY-Benchmark, wird NICHT ausgezahlt und fließt NICHT in die GuV (siehe finances-types.ts).
  // Gleiche Herleitung wie die Preisgeld-/Saisonstand-Views (`buildTeamSeasonOverviewRows`).
  // Feldnamen im Overview-Row sind historisch "sponsor*" benannt, meinen hier aber das Preisgeld.
  const overviewRow = buildTeamSeasonOverviewRows({ gameState }).find((row) => row.teamId === teamId) ?? null;
  const prizeTotal = overviewRow?.sponsorTotal;
  const prize: FinancePrizeIncome | null =
    prizeTotal != null && Number.isFinite(prizeTotal)
      ? {
          total: round1(prizeTotal),
          basis: round1(overviewRow?.sponsorBasis ?? 0),
          seasonShare: round1(overviewRow?.sponsorSeason ?? 0),
          placementBonus: round1(overviewRow?.sponsorRank ?? 0),
        }
      : null;

  const guv = operating.guv;

  // --- Saison-Verlauf + Cash-Abgleich (T-107, T-031) -----------------------
  // Echte archivierte Season-End-Werte aus `gameState.seasonState.seasonSnapshots`
  // (`SeasonSnapshotTeamRecord.guv`/`.cashTotal`/`.cashEnd`) — KEIN Forecast wie
  // der 5-Saisons-Ausblick in prize-v2, reine Historie, keine neue Persistenz.
  // Cash trägt sich unverändert über den Saisonwechsel fort (siehe
  // `preseason-workflow-service.ts`, kein Cash-Reset), daher ist das Cash-Ende
  // der unmittelbar vorangegangenen Saison zugleich der Season-Start-Wert
  // dieser Saison.
  const pastSeasonPoints: FinanceSeasonHistoryPoint[] = (gameState.seasonState.seasonSnapshots ?? [])
    .map((snapshot): FinanceSeasonHistoryPoint | null => {
      const row = snapshot.finalStandings.find((entry) => entry.teamId === teamId) ?? null;
      if (!row) return null;
      // T-108 (d): reales fortgeschriebenes Cash-Ende BEVORZUGEN (`cashEnd`), NICHT das
      // benchmark-`cashTotal` (= projiziertes `projectedCash` aus `writeLocalCashPrizeApply`,
      // kein reales Cash). Der archivierte `guv` wurde mit der alten prize-als-Einnahme-Formel
      // gebildet und ist nicht mit der korrigierten GuV vergleichbar → bewusst `null`, damit die
      // Sparkline ehrlich in den Empty-State degradiert statt Phantomwerte zu zeigen.
      const cash = row.cashEnd ?? row.cashTotal ?? null;
      return {
        seasonId: snapshot.seasonId,
        seasonName: snapshot.seasonName,
        isCurrent: false,
        guv: null,
        cash: cash != null && Number.isFinite(cash) ? round1(cash) : null,
      };
    })
    .filter((point): point is FinanceSeasonHistoryPoint => point != null)
    .sort((left, right) => left.seasonId.localeCompare(right.seasonId, "de", { numeric: true }))
    .slice(-HISTORY_PAST_SEASONS);

  const cashSeasonStart = pastSeasonPoints.at(-1)?.cash ?? null;
  // Reine Differenz: absorbiert alles, was Cash bewegt, aber keine GuV ist — Kredit-Auszahlung und
  // -Tilgung sowie der Transfer-Saldo (Sonderposten). Damit bleibt
  // `cashSeasonStart + guv + otherCashMovements == cash` gültig.
  const otherCashMovements = cashSeasonStart != null ? round1(team.cash - cashSeasonStart - guv) : null;

  const history: FinanceSeasonHistoryPoint[] = [
    ...pastSeasonPoints,
    { seasonId: gameState.season.id, seasonName: gameState.season.name, isCurrent: true, guv, cash: team.cash },
  ];

  const teamFinances: TeamFinancesState = {
    teamId,
    cash: team.cash,
    income: {
      sponsor: operating.sponsor,
      facilityIncome: operating.facilityIncome,
      transferSurplus: operating.transferSurplus,
      objectiveReward: operating.objectiveReward,
      apronPayout: operating.apronPayout,
      prizeBenchmark: prize,
    },
    expenses: {
      salaries: operating.salaries,
      facilityUpkeep: operating.facilityUpkeep,
      // `total`/Zeilen = Kredit-ZINS der Saison (GuV-Ausgabe), NICHT die volle Rate — der
      // Tilgungsanteil ist eine Bilanzbewegung, keine Ausgabe.
      loanInstallments: operating.loanInstallments,
      transferDeficit: operating.transferDeficit,
      objectivePenalty: operating.objectivePenalty,
      apronLevy: operating.apronLevy,
    },
    transfer: operating.transfer,
    totalIncome: operating.totalIncome,
    totalExpenses: operating.totalExpenses,
    guv,
    operating,
    cashSeasonStart,
    otherCashMovements,
    history,
  };

  return { status: "ready", team: teamFinances };
}

/**
 * React hook wrapper around `buildFinancesViewModel`. Hosts should prefer
 * this over calling the builder directly so the model is memoized per
 * render the same way `useCreditsViewModel` is.
 */
export function useFinancesViewModel(gameState: GameState, teamId: string | null): FinancesViewModel {
  return useMemo(() => buildFinancesViewModel(gameState, teamId), [gameState, teamId]);
}
