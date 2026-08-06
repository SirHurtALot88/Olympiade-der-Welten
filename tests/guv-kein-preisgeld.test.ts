import { describe, expect, it } from "vitest";

import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";
import { buildTeamSeasonOverviewRows } from "@/lib/foundation/team-management-overview";

/**
 * ROTER ALARM (Chris): „ich habe jetzt das Cash gebucht und so viele Teams hatten ne positive GuV und
 * jetzt haben so viele Teams negatives Cash???? Da stimmt doch die GuV-Anzeige mit dem was
 * letztendlich gebucht wird gar nicht überein."
 *
 * Die Ursache war eine Zeile in `team-management-overview.ts`:
 *
 *     guv: normalizeEconomyMoney(prizeSummary?.profitLoss ?? row.guv) ?? …
 *
 * `prizeSummary` ist die ABGESCHAFFTE Preisgeldkurve (`CASH_PRIZE_BENCHMARK_ONLY = true`, wird nie
 * ausgezahlt). Weil sie für jede Zeile eine Zahl liefert, kam `row.guv` — der echte, gebuchte Wert —
 * nie zum Zug. Dieser Test hält fest, dass der echte Wert gewinnt und dass es KEINEN
 * Preisgeld-Rückfall mehr gibt.
 */
describe("Die Saisonstand-GuV kommt nicht mehr aus dem Preisgeld", () => {
  it("übernimmt den echten Stand statt ihn mit dem Benchmark zu überschreiben", () => {
    const gameState = createSingleplayerGameState();
    const teamId = gameState.teams[0]!.teamId;
    // Ein Wert, den die Preisgeldkurve nie produzieren würde.
    const echterWert = -77.7;
    const rows = buildTeamSeasonOverviewRows({
      gameState,
      standingsByTeamId: {
        [teamId]: { rank: 5, points: 40, cash: 10, guv: echterWert, sponsorTotal: 12.3 },
      },
    });
    const row = rows.find((entry) => entry.teamId === teamId);

    expect(row?.guv).toBe(echterWert);
    expect(row?.sponsorTotal).toBe(12.3);
  });

  it("lässt die GuV leer, wenn es keinen echten Wert gibt — statt den Benchmark zu erfinden", () => {
    // Eine leere Zelle ist ehrlich. Eine Preisgeldzahl an dieser Stelle war der Bug: sie kennt weder
    // Gebäude noch Apron noch Kredite noch Vorstandsziele und lag deshalb systematisch zu hoch.
    const gameState = createSingleplayerGameState();
    const teamId = gameState.teams[0]!.teamId;
    const rows = buildTeamSeasonOverviewRows({
      gameState,
      standingsByTeamId: { [teamId]: { rank: 5, points: 40, cash: 10 } },
    });
    const row = rows.find((entry) => entry.teamId === teamId);

    expect(row?.guv).toBeNull();
    expect(row?.sponsorTotal).toBeNull();
  });
});
