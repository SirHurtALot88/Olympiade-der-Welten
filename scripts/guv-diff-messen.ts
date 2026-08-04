/**
 * TEMPORÄR (Ticket 24): misst die Differenz zwischen der Saisonstand-GuV und der Finanzen-GuV
 * je Team im echten Spielstand. Wird am Ende des Laufs wieder gelöscht.
 */
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { getLeagueSponsorIncome } from "@/lib/season/prize-money-preview";
import { buildFinancesViewModel } from "@/lib/foundation/finances/use-finances-view-model";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import { previewApronSettlement } from "@/lib/season/apron-settlement-service";
import { buildTeamSeasonObjectiveSettlement } from "@/lib/board/team-season-objectives-service";
import { getTeamAnnualLoanInterest } from "@/lib/finance/loan-service";

const SAVE_ID = "new-game-1785823388048-1hf25q";

function r1(value: number): number {
  return Number(value.toFixed(1));
}

async function main() {
  const persistence = createPersistenceService();
  const save = persistence.getSaveById(SAVE_ID);
  if (!save) throw new Error("Save nicht gefunden");
  const gameState = save.gameState;
  console.log("Save:", save.saveId, "| Season:", gameState.season.id, "| Matchday:", gameState.matchdayState?.matchdayId);

  const sponsorIncome = getLeagueSponsorIncome(gameState, save.saveId);
  const playerById = new Map(gameState.players.map((p) => [p.id, p] as const));
  const apron = previewApronSettlement(gameState);
  const apronByTeam = new Map(apron.rows.map((row) => [row.teamId, row] as const));
  const objective = buildTeamSeasonObjectiveSettlement(gameState);

  console.log("Apron: lines=", JSON.stringify(apron.lines), "topf=", apron.topf, "zahler=", apron.zahlerCount, "empf=", apron.empfaengerCount, "blocking=", apron.blockingReasons.join(","));

  const rows: Array<Record<string, unknown>> = [];
  for (const team of gameState.teams) {
    const liveSponsorCash = sponsorIncome.sponsorCashByTeamId.get(team.teamId) ?? null;
    const liveFacilityIncome = sponsorIncome.facilityIncomeByTeamId.get(team.teamId) ?? null;
    const salaryTotal = gameState.rosters
      .filter((entry) => entry.teamId === team.teamId)
      .reduce(
        (sum, entry) => sum + (resolvePlayerEconomyContract({ player: playerById.get(entry.playerId), rosterEntry: entry }).salary ?? 0),
        0,
      );
    const standingsGuv =
      liveSponsorCash != null ? Number((liveSponsorCash + (liveFacilityIncome ?? 0) - salaryTotal).toFixed(2)) : null;

    const model = buildFinancesViewModel(gameState, team.teamId);
    const fin = model.status === "ready" ? model.team : null;
    const apronRow = apronByTeam.get(team.teamId);
    const objCash = objective.byTeamId[team.teamId]?.cashDelta ?? 0;

    rows.push({
      team: team.shortCode,
      standingsGuv,
      finGuv: fin?.guv ?? null,
      diff: standingsGuv != null && fin ? r1(standingsGuv - fin.guv) : null,
      sponsorStand: liveSponsorCash != null ? r1(liveSponsorCash) : null,
      sponsorFin: fin?.income.sponsor?.total ?? null,
      sponsorIsEstimate: fin?.income.sponsor?.totalIsEstimate ?? null,
      facNetStand: liveFacilityIncome,
      facIncFin: fin?.income.facilityIncome?.total ?? 0,
      facUpkFin: fin?.expenses.facilityUpkeep.total ?? 0,
      salaryStand: r1(salaryTotal),
      salaryFin: fin?.expenses.salaries.total ?? null,
      loanInterest: r1(getTeamAnnualLoanInterest(gameState, team.teamId)),
      objective: r1(objCash),
      apronNet: apronRow ? r1(apronRow.nettoDelta) : null,
      transferNet: fin?.transfer?.net ?? null,
      cash: team.cash,
    });
  }

  console.table(rows);

  // Summenprüfung: woraus besteht die Differenz genau?
  console.log("\n--- Zerlegung der Differenz (Saisonstand − Finanzen) ---");
  for (const row of rows) {
    const facDelta = r1((row.facNetStand as number ?? 0) - ((row.facIncFin as number) - (row.facUpkFin as number)));
    const erklaert = r1(facDelta + (row.loanInterest as number) - (row.objective as number));
    console.log(
      `${row.team}: diff=${row.diff} | Gebäude-Delta=${facDelta} + Zins=${row.loanInterest} − Ziele=${row.objective} => erklärt=${erklaert} | Rest=${r1((row.diff as number) - erklaert)}`,
    );
  }
}

void main();
