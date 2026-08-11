/**
 * DREI FELDER DER STANDINGS-ROUTE STANDEN HART AUF `null`.
 *
 * `/api/season/standings-overview` lieferte `rosterCount`, `salaryTotal` und `marketValueTotal` in
 * BEIDEN Zusammenbau-Blöcken als `null` aus — obwohl der `sqlite`-Zweig die Gehaltssumme im selben
 * Scope bereits rechnete (`localSalaryTotalByTeamId`, weitergereicht an den GuV-Resolver) und
 * Kader wie Spieler dort vollständig vorliegen. Am Saisonstand fiel es nicht auf, weil
 * `SeasonStandingsNewLook` seine Zeilen aus `seasonStandRows` bezieht; jeder andere Konsument der
 * Route bekam einen Strich.
 *
 * Am Live-Abbild gemessen (Save `new-game-1785823388048-1hf25q`, Saison 2, 32 Teams): vorher 0 von
 * 32 Teams mit einem dieser drei Werte, nachher 32 von 32 — A-A 12 Spieler, 57,55 Gehalt, 219,57
 * Marktwert.
 *
 * Der Test prüft die WIRKUNG an der echten Route mit echter Persistenz: er fährt `GET` und
 * vergleicht das Ergebnis nicht mit im Test nachgerechneten Wunschzahlen, sondern mit der EINEN
 * Definition (`resolvePlayerEconomyContract`) auf demselben persistierten Spielstand.
 *
 * `form` bleibt ausdrücklich `null` und wird hier auch so festgehalten: `StandingRecord`
 * (`lib/data/olyDataTypes.ts`) kennt das Feld nicht, es gibt im ganzen Spielstand keinen Schreiber
 * dafür (am Live-Abbild 0 von 32), und eine erfundene Zahl wäre schlimmer als ein Strich.
 */
import { beforeAll, describe, expect, it } from "vitest";

import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { resetDatabaseForTests } from "@/lib/persistence/sqlite";

type Zeile = {
  teamId: string;
  form: number | null;
  rosterCount: number | null;
  salaryTotal: number | null;
  marketValueTotal: number | null;
};

let saveId: string;
let zeilen: Zeile[];

/** Dieselbe Definition wie im Team-Management — nicht im Test nachgebaut, sondern importiert. */
function kaderzahlenAusSpielstand(teamId: string) {
  const gameState = createPersistenceService().getSaveById(saveId)!.gameState;
  const playerById = new Map(gameState.players.map((player) => [player.id, player] as const));
  const roster = gameState.rosters.filter((entry) => entry.teamId === teamId);
  let salaryTotal = 0;
  let marketValueTotal = 0;
  for (const entry of roster) {
    const contract = resolvePlayerEconomyContract({ player: playerById.get(entry.playerId), rosterEntry: entry });
    salaryTotal += contract.salary ?? 0;
    marketValueTotal += contract.marketValue ?? 0;
  }
  return {
    rosterCount: roster.length,
    salaryTotal: Number(salaryTotal.toFixed(2)),
    marketValueTotal: Number(marketValueTotal.toFixed(2)),
  };
}

beforeAll(async () => {
  resetDatabaseForTests();
  saveId = createPersistenceService().bootstrapSingleplayerSave().save.saveId;

  const { GET } = await import("@/app/api/season/standings-overview/route");
  const response = await GET(
    new Request(`http://localhost/api/season/standings-overview?saveId=${saveId}&source=sqlite`),
  );
  expect(response.status).toBe(200);
  zeilen = ((await response.json()) as { items: Zeile[] }).items;
}, 120_000);

describe("standings-overview: Kaderzahlen kommen aus dem Spielstand, nicht als Strich", () => {
  it("liefert überhaupt Zeilen", () => {
    expect(zeilen.length).toBeGreaterThan(0);
  });

  it("rosterCount/salaryTotal/marketValueTotal sind für JEDES Team gefüllt", () => {
    const mitKader = zeilen.filter((zeile) => {
      const gameState = createPersistenceService().getSaveById(saveId)!.gameState;
      return gameState.rosters.some((entry) => entry.teamId === zeile.teamId);
    });
    expect(mitKader.length).toBe(zeilen.length);

    expect(zeilen.filter((zeile) => zeile.rosterCount != null).length).toBe(zeilen.length);
    expect(zeilen.filter((zeile) => zeile.salaryTotal != null).length).toBe(zeilen.length);
    expect(zeilen.filter((zeile) => zeile.marketValueTotal != null).length).toBe(zeilen.length);
  });

  it("die Zahlen stimmen mit der EINEN Definition überein", () => {
    for (const zeile of zeilen) {
      const erwartet = kaderzahlenAusSpielstand(zeile.teamId);
      expect(zeile.rosterCount).toBe(erwartet.rosterCount);
      expect(zeile.salaryTotal).toBeCloseTo(erwartet.salaryTotal, 2);
      expect(zeile.marketValueTotal).toBeCloseTo(erwartet.marketValueTotal, 2);
    }
  });

  it("`form` bleibt bewusst null — es gibt keinen Schreiber dafür", () => {
    expect(zeilen.every((zeile) => zeile.form === null)).toBe(true);
    const standings = createPersistenceService().getSaveById(saveId)!.gameState.seasonState.standings ?? {};
    const mitForm = Object.values(standings).filter(
      (standing) => (standing as Record<string, unknown>).form != null,
    ).length;
    expect(mitForm).toBe(0);
  });
});
