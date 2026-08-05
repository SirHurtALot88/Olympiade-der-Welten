/**
 * GEMELDET: „da schau, das passt nicht" — in der Kader-Uebersicht stand fuer denselben Spieler ein
 * Buyout von 0,0 Mio, waehrend der Verkaufsdialog fuer ihn 8,8 Mio abzog. Und: „im VK Modal steht
 * auch n Faktor von 1,21 was dem angezeigten widerspricht — geringerer Basiswert und Buyout kosten
 * — obwohl der Vertrag auslaeuft — das darf nicht sein."
 *
 * Ursache war keine Rechnung, sondern zwei Konventionen: die Uebersichten rechneten mit
 * `seasonsElapsed: 1`, Vorschau/Ausfuehrung/KI mit dem Default 0. Beide Seiten hatten das
 * ausfuehrlich begruendet — und beide hatten hingeschrieben, dass die andere Seite unberuehrt
 * bleibt. Jetzt entscheidet der Spielstand: das laufende Vertragsjahr faellt aus der Abloese,
 * sobald das Gehalt dieser Saison gebucht ist.
 */
import type { GameState, RosterEntry } from "@/lib/data/olyDataTypes";
import { resolveElapsedContractSeasonsForBuyout } from "@/lib/market/contract-buyout-season-window";
import { resolveOpenBuyoutCostForRoster, resolveTransfermarktSellProceeds } from "@/lib/market/transfermarkt-sell-proceeds";
import { describe, expect, it } from "vitest";

const eintrag = (contractLength: number): RosterEntry =>
  ({
    id: `roster-${contractLength}`,
    saveId: "save-test",
    teamId: "A-A",
    playerId: "spieler-1",
    contractLength,
    salary: 8.8,
    contractShape: "balanced",
    yearlySalarySchedule: Array.from({ length: contractLength }, (_, index) => ({
      seasonId: `season-${index + 1}`,
      seasonLabel: `Season ${index + 1}`,
      salary: 8.8,
    })),
  }) as unknown as RosterEntry;

const spielstand = (gehaltGebucht: boolean): GameState =>
  ({
    season: { id: "season-1", name: "Season 1" },
    seasonState: {
      sponsorPayoutLogs: gehaltGebucht
        ? [
            {
              id: "log-1",
              saveId: "save-test",
              seasonId: "season-1",
              teamId: "A-A",
              phase: "season_end",
              componentId: "salary_deduct",
              cashDelta: -123,
              action: "apply",
              createdAt: "2026-08-05T00:00:00.000Z",
            },
          ]
        : [],
    },
  }) as unknown as GameState;

describe("Der Buyout hat eine Regel statt zweier", () => {
  it("zaehlt das laufende Vertragsjahr mit, solange das Gehalt dieser Saison offen ist", () => {
    expect(resolveElapsedContractSeasonsForBuyout({ gameState: spielstand(false), teamId: "A-A" })).toBe(0);
    expect(resolveOpenBuyoutCostForRoster({ rosterEntry: eintrag(3), gameState: spielstand(false) })).toBeCloseTo(26.4, 2);
  });

  it("laesst es raus, sobald das Gehalt dieser Saison gebucht ist", () => {
    expect(resolveElapsedContractSeasonsForBuyout({ gameState: spielstand(true), teamId: "A-A" })).toBe(1);
    expect(resolveOpenBuyoutCostForRoster({ rosterEntry: eintrag(3), gameState: spielstand(true) })).toBeCloseTo(17.6, 2);
  });

  it("kostet einen auslaufenden Vertrag im Saisonende-Fenster nichts mehr", () => {
    // Der gemeldete Fall: Vertrag laeuft aus, trotzdem zog der Dialog ein volles Jahresgehalt ab.
    expect(resolveOpenBuyoutCostForRoster({ rosterEntry: eintrag(1), gameState: spielstand(true) })).toBe(0);
  });

  it("beantwortet ein anderes Team nicht mit der Buchung des ersten", () => {
    // Der Gehaltsabzug wird pro Team protokolliert — ein Log fuer A-A sagt nichts ueber B-B.
    expect(resolveElapsedContractSeasonsForBuyout({ gameState: spielstand(true), teamId: "B-B" })).toBe(0);
  });

  it("faellt ohne Spielstand auf die volle Restlaufzeit zurueck", () => {
    // Fixtures und der (nicht verdrahtete) Prisma-Pfad reichen keinen GameState durch.
    expect(resolveElapsedContractSeasonsForBuyout({ gameState: null, teamId: "A-A" })).toBe(0);
    expect(resolveElapsedContractSeasonsForBuyout({ gameState: spielstand(true), teamId: null })).toBe(0);
  });

  it("laesst einen ausdruecklich gesetzten Wert weiter gewinnen", () => {
    // Die Ableitung ist der Default, kein Zwang — Tests und Sonderpfade duerfen sie uebersteuern.
    expect(
      resolveOpenBuyoutCostForRoster({ rosterEntry: eintrag(3), gameState: spielstand(true), seasonsElapsed: 0 }),
    ).toBeCloseTo(26.4, 2);
  });

  it("laesst den Netto-Erloes eines auslaufenden Vertrags gleich dem Brutto sein", () => {
    // Genau die Zahl aus dem Screenshot: brutto 30,1 bei Faktor 1,21x auf MW 24,9 — ohne Buyout
    // bleibt der Aufschlag stehen, statt sich in ein Minus zu drehen.
    const erloes = resolveTransfermarktSellProceeds({
      rosterEntry: eintrag(1),
      grossSalePrice: 30.1,
      gameState: spielstand(true),
    });
    expect(erloes.buyoutCost).toBe(0);
    expect(erloes.netProceeds).toBeCloseTo(30.1, 2);
  });
});
