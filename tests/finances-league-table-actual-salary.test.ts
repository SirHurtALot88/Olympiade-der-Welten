import { describe, expect, it } from "vitest";

import { buildFinancesLeagueTable } from "@/lib/foundation/finances/use-finances-league-table";
import { getTeamActualSalaryTotal, getTeamDisplaySalaryTotal } from "@/lib/sponsor/sponsor-team-salary-display";
import type { GameState } from "@/lib/data/olyDataTypes";

/**
 * GEMELDET: „in der finanzansicht hat Z-H weniger gehälter als in dieser ansicht??? was stimmt
 * denn nun bitte den aktuellen wert aus den veträgen ziehen inkl. FL oder BL nicht den
 * durchschnitts gehalt wert."
 *
 * FL/BL sind `front_loaded` / `back_loaded`. Bei diesen Vertragsformen weicht die aktuelle Rate
 * bewusst vom Mittelwert ab:
 *
 *   `contract.salary`         die Rate, die JETZT faellig wird       ← massgeblich
 *   `contract.expectedSalary` der geglaettete Formelwert (Mittel)
 *
 * Die Liga-Finanztabelle summierte `expectedSalary`, der Saisonstand `salary` — derselbe
 * Spielstand, zwei Gehaltssummen. Am echten Spielstand gemessen:
 *
 *   Z-H  Ausgaben 83,3 → 97,7   GuV +13,3 → −1,1   (Sunken Crown zahlt 13,34 statt 9,74)
 *   M-M  Ausgaben 84,4 → 95,7   GuV +11,2 → −0,1
 *   T-C  Ausgaben 51,3 → 44,2   GuV +37,0 → +44,1
 *
 * Bei Z-H kippt die GuV ins Minus: das Team lebte ueber seinen Verhaeltnissen, die Anzeige
 * zeigte es nur nicht.
 *
 * `salary` ist massgeblich, weil genau dieses Feld am Saisonende abgebucht wird
 * (`sponsor-settlement-service`: `resolvePlayerEconomyContract(...).salary ?? 0`).
 */
function gameStateWithSalaries(entries: Array<{ salary: number; expectedSalary: number }>): GameState {
  return {
    season: { id: "season-1" },
    gamePhase: "season_completed",
    matchdayState: { matchdayId: "matchday-10" },
    teams: [{ teamId: "T1", shortCode: "T-1", name: "Testteam", cash: 10 }],
    players: entries.map((_, index) => ({ id: `p${index}`, name: `Spieler ${index}` })),
    rosters: entries.map((entry, index) => ({
      id: `r${index}`,
      teamId: "T1",
      playerId: `p${index}`,
      // Beide Felder liegen am Kadereintrag; `resolvePlayerEconomyContract` reicht die
      // importierten Werte unveraendert durch.
      salary: entry.salary,
      calculatedSalary: entry.expectedSalary,
      contractLength: 1,
    })),
    disciplines: [],
    seasonState: {
      seasonId: "season-1",
      standings: {},
      schedule: [],
      matchdayResults: [],
      disciplineResults: [],
      sponsorContractsByTeamId: {},
      sponsorPayoutLogs: [],
      lineupDrafts: [],
    },
    transferHistory: [],
  } as never;
}

describe("Liga-Finanztabelle: Gehälter aus dem echten Vertragswert", () => {
  it("summiert die aktuell fällige Rate, nicht den geglätteten Mittelwert", () => {
    // Ein front-loaded Vertrag: aktuell 13,34 faellig, Formelwert 9,74.
    const rows = buildFinancesLeagueTable(
      gameStateWithSalaries([
        { salary: 13.34, expectedSalary: 9.74 },
        { salary: 5.48, expectedSalary: 4.99 },
      ]),
    );
    const row = rows.find((entry) => entry.teamId === "T1");
    expect(row).toBeTruthy();
    // 13,34 + 5,48 = 18,82 — nicht 9,74 + 4,99 = 14,73.
    expect(row!.expensesAnnual).toBeCloseTo(18.82, 1);
    expect(row!.expensesAnnual).not.toBeCloseTo(14.73, 1);
  });

  it("gilt in beide Richtungen — back-loaded zahlt jetzt WENIGER als der Mittelwert", () => {
    const rows = buildFinancesLeagueTable(
      gameStateWithSalaries([{ salary: 4.2, expectedSalary: 6.8 }]),
    );
    expect(rows.find((entry) => entry.teamId === "T1")!.expensesAnnual).toBeCloseTo(4.2, 1);
  });

  /**
   * FRUEHER STAND HIER EIN QUELLTEXT-TEST (`expect(source).toContain("normalizeEconomyMoney(...)")`).
   * Der ist wertlos: er bleibt gruen, auch wenn die Funktion daneben tot ist oder eine zweite Stelle
   * anders rechnet — genau die Fehlerklasse, die der Pruefplan vom 11.08.2026 als „Tests, die
   * Quelltext-Strings pruefen" benennt. Jetzt wird der WERT gegen die geteilte Buchungsfunktion
   * gehalten.
   */
  it("nutzt dieselbe Quelle, die am Saisonende wirklich abgebucht wird", () => {
    const gameState = gameStateWithSalaries([
      { salary: 13.34, expectedSalary: 9.74 },
      { salary: 5.48, expectedSalary: 4.99 },
    ]);
    const row = buildFinancesLeagueTable(gameState).find((entry) => entry.teamId === "T1")!;
    // `getTeamActualSalaryTotal` ist die Funktion, die `applySponsorSettlement` am Saisonende
    // abbucht. Ohne Gebaeude und Kredite ist die Gehaltssumme die ganze Ausgabenseite.
    expect(row.expensesAnnual).toBeCloseTo(getTeamActualSalaryTotal(gameState, "T1"), 2);
  });

  /**
   * Der Sponsor-Anker haengt ueber `getTeamSponsorBaseReferenceTotal` an
   * `getTeamDisplaySalaryTotal`. Wuerde man DIE Funktion mit umstellen, verschoebe sich die
   * Sponsoren-Kalibrierung — das gehoert in die Balance-Entscheidung, nicht in einen
   * Anzeige-Fix. Dieser Test haelt die Trennung an WERTEN fest, nicht am Quelltext.
   */
  it("laesst den Sponsor-Anker unberührt: die geglaettete Summe folgt weiter dem Formelwert", () => {
    // `salaryDemand` speist `expectedSalary`; die faellige Rate steht am Kadereintrag.
    const gameState = {
      ...gameStateWithSalaries([{ salary: 13.34, expectedSalary: 9.74 }]),
      players: [{ id: "p0", name: "Spieler 0", salaryDemand: 9.74 }],
    } as never as GameState;
    expect(getTeamDisplaySalaryTotal(gameState, "T1")).toBeCloseTo(9.7, 1);
    expect(getTeamActualSalaryTotal(gameState, "T1")).toBeCloseTo(13.3, 1);
  });
});
