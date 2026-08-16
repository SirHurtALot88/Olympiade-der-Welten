/**
 * DIE KLAMMER HINTER DEM DISZIPLINNAMEN ZEIGT DIE AUSGELOSTE KADERGROESSE, NICHT DEN KATALOGWERT.
 *
 * Im Roster-PPs-Panel steht hinter jeder Disziplin eine Zahl in Klammern — „(6)" — und sie
 * behauptet, wie viele Spieler pro Team dort antreten. Gelesen wurde dafuer
 * `gameState.disciplines[].playerCount`, also der KATALOG.
 *
 * Der Katalogwert ist aber nur der Startzustand: der Disziplin-Spielplan lost die Kadergroesse pro
 * Saison neu aus (`buildSeasonSeededDisciplineSchedule`). An einem durchgespielten Saison-1-Stand
 * gemessen weichen die beiden bei 15 von 20 Disziplinen voneinander ab — bei Tennis stand im
 * Katalog 3, angetreten sind 6.
 *
 * Dieselbe Verwechslung gab es an drei weiteren Anzeigen (Disziplin-Buehne, Verletzungs-Historie,
 * Spieler-Detailansicht) und in den Forderungs-Schwellen; sie sind bereits umgestellt. Diese
 * Fundstelle war die letzte offene aus derselben Durchsuchung.
 */
import { describe, expect, it } from "vitest";

import { buildRosterDisciplinePpsByAxis } from "@/lib/foundation/tabs/use-foundation-cross-tab-teams-roster";
import type { GameState } from "@/lib/data/olyDataTypes";

const KATALOG = [
  { id: "tennis", name: "Tennis", category: "mental", weight: 1, playerCount: 3, originalOrder: 1, displayOrder: 1 },
] as unknown as GameState["disciplines"];

const ACHSEN_TOTALS = { pow: null, spe: null, men: 12, soc: null } as never;

describe("Roster-PPs-Panel: Kadergroesse in der Klammer", () => {
  it("nimmt die ausgeloste Spielplan-Groesse, nicht den Katalogwert", () => {
    const zeilen = buildRosterDisciplinePpsByAxis({
      disciplines: KATALOG,
      seasonPlayerCountByDisciplineId: new Map([["tennis", 6]]),
      pointsByDiscipline: { tennis: 12 },
      pointsByArea: null,
      axisTotals: ACHSEN_TOTALS,
    });
    const tennis = zeilen.flatMap((achse) => achse.disciplines).find((d) => d.id === "tennis");
    expect(tennis, "Tennis fehlt in der Achsenliste").toBeTruthy();
    expect(tennis!.playerCount, "Katalogwert 3 statt der ausgelosten 6").toBe(6);
  });

  it("faellt auf den Katalog zurueck, wenn der Spielplan die Disziplin nicht kennt", () => {
    // Der Fall tritt real auf: eine Disziplin, die DIESE Saison gar nicht laeuft, steht trotzdem
    // in der Nachschlage-Liste. Dann ist der Katalogwert die einzige Zahl, die es gibt.
    const zeilen = buildRosterDisciplinePpsByAxis({
      disciplines: KATALOG,
      seasonPlayerCountByDisciplineId: new Map(),
      pointsByDiscipline: null,
      pointsByArea: null,
      axisTotals: ACHSEN_TOTALS,
    });
    const tennis = zeilen.flatMap((achse) => achse.disciplines).find((d) => d.id === "tennis");
    expect(tennis!.playerCount).toBe(3);
  });

  it("zeigt nichts an, wenn beide Quellen nichts hergeben — statt eine Zahl zu erfinden", () => {
    const ohneZahl = [{ ...KATALOG[0], playerCount: undefined }] as unknown as GameState["disciplines"];
    const zeilen = buildRosterDisciplinePpsByAxis({
      disciplines: ohneZahl,
      seasonPlayerCountByDisciplineId: new Map([["tennis", null]]),
      pointsByDiscipline: null,
      pointsByArea: null,
      axisTotals: ACHSEN_TOTALS,
    });
    const tennis = zeilen.flatMap((achse) => achse.disciplines).find((d) => d.id === "tennis");
    expect(tennis!.playerCount).toBeNull();
  });
});
