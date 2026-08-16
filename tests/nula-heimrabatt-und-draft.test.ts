import { describe, expect, it } from "vitest";

import { ensureNulaOnProjectSuicide, NULA_PLAYER_ID } from "@/lib/foundation/ensure-nula-on-project-suicide";
import type { GameState } from "@/lib/data/olyDataTypes";

/**
 * DAS MASKOTTCHEN — Heimrabatt und Dauervertrag.
 *
 * CHRIS: „Nula gehört mit dazu die bleibt bei P-S und sorge dafür dass sie auch verlängerungen
 * bekommt von ihren verträgen immer so lang wie geht und sie ist aber 50% günstiger für P-S weil
 * sie sich dort immer mega wohl fühlt."
 *
 * WARUM DER RABATT AUF DEM GEHALT LIEGT UND NICHT AUF DER ABLOESE: die Abloese wechselt bei einem
 * Team-zu-Team-Transfer den Besitzer. Zahlte P-S nur die Haelfte, waehrend das abgebende Team den
 * vollen Preis bekaeme, entstuende Geld aus dem Nichts — genau die Fehlerklasse, wegen der die
 * Nula-Buchung ueberhaupt eingefuehrt wurde. Der letzte Test haelt diese Bilanz fest.
 */

const GEHALT = 4;
const PREIS = 10;

function spielstand(overrides?: { nulaTeamId?: string | null; salary?: number; contractLength?: number }): GameState {
  const rosters =
    overrides?.nulaTeamId === undefined
      ? []
      : overrides.nulaTeamId === null
        ? []
        : [
            {
              id: "roster-nula",
              teamId: overrides.nulaTeamId,
              playerId: NULA_PLAYER_ID,
              contractLength: overrides.contractLength ?? 5,
              contractStatus: "active",
              salary: overrides.salary ?? GEHALT,
              negotiatedAnnualSalary: overrides.salary ?? GEHALT,
              upkeep: 0,
              purchasePrice: PREIS,
              currentValue: PREIS,
              roleTag: "bench",
              joinedSeasonId: "season-1",
            },
          ];
  return {
    season: { id: "season-1", name: "Season 1" },
    seasonState: {},
    teams: [
      { teamId: "P-S", name: "Project Suicide", cash: 100 },
      { teamId: "A-A", name: "Alpha", cash: 100 },
    ],
    players: [{ id: NULA_PLAYER_ID, name: "Nula", marketValue: PREIS, salaryDemand: GEHALT }],
    rosters,
    transferHistory: [],
  } as never;
}

function nulaEintrag(gs: GameState) {
  return gs.rosters.find((eintrag) => eintrag.playerId === NULA_PLAYER_ID) ?? null;
}

describe("Nula: Heimrabatt bei Project Suicide", () => {
  it("zahlt beim Kauf nur das halbe Gehalt", () => {
    const nachher = ensureNulaOnProjectSuicide(spielstand());
    const eintrag = nulaEintrag(nachher);
    expect(eintrag?.teamId).toBe("P-S");
    expect(eintrag?.salary).toBe(GEHALT / 2);
    expect(eintrag?.negotiatedAnnualSalary).toBe(GEHALT / 2);
  });

  it("zieht den Rabatt auch bei einem Bestandsvertrag nach", () => {
    // Ohne diese Nachbesserung liefe der Transform bei einem alten Spielstand ins No-op, und der
    // Rabatt kaeme nie an — er haenge dann am Zufall, ob Nula gerade neu gekauft wurde.
    const alt = spielstand({ nulaTeamId: "P-S", salary: GEHALT, contractLength: 5 });
    const eintrag = nulaEintrag(ensureNulaOnProjectSuicide(alt));
    expect(eintrag?.salary).toBe(GEHALT / 2);
  });

  it("bleibt still, wenn der Rabatt schon drin ist — der Transform laeuft bei JEDEM Laden", () => {
    const schonRichtig = spielstand({ nulaTeamId: "P-S", salary: GEHALT / 2, contractLength: 5 });
    const nachher = ensureNulaOnProjectSuicide(schonRichtig);
    // Unveraenderte Referenz: sonst schriebe jedes Laden den Spielstand neu.
    expect(nachher).toBe(schonRichtig);
  });
});

describe("Nula: der Vertrag laeuft nie aus", () => {
  it("verlaengert auf die Maximallaufzeit", () => {
    const kurz = spielstand({ nulaTeamId: "P-S", salary: GEHALT / 2, contractLength: 1 });
    expect(nulaEintrag(ensureNulaOnProjectSuicide(kurz))?.contractLength).toBe(5);
  });

  it("holt sie von einem anderen Team zurueck — mit Maximalvertrag und Rabatt", () => {
    const fremd = spielstand({ nulaTeamId: "A-A", salary: GEHALT, contractLength: 3 });
    const eintrag = nulaEintrag(ensureNulaOnProjectSuicide(fremd));
    expect(eintrag?.teamId).toBe("P-S");
    expect(eintrag?.contractLength).toBe(5);
    expect(eintrag?.salary).toBe(GEHALT / 2);
  });
});

describe("Nula: die Abloese bleibt bilanzneutral", () => {
  /**
   * DER RABATT DARF DIE ABLOESE NICHT ANFASSEN. Beim Team-zu-Team-Transfer zahlt P-S und das
   * abgebende Team bekommt — beide Betraege muessen gleich sein, sonst entsteht Geld aus dem
   * Nichts. Genau daran ist die Nula-Sonderregel schon einmal aufgefallen: P-S war das einzige
   * Team, dessen Kasse ueber zwei Saisons nicht aufging.
   */
  it("nimmt P-S genau das, was das abgebende Team bekommt", () => {
    const vorher = spielstand({ nulaTeamId: "A-A", salary: GEHALT, contractLength: 3 });
    const nachher = ensureNulaOnProjectSuicide(vorher);
    const kasse = (gs: GameState, teamId: string) => gs.teams.find((team) => team.teamId === teamId)?.cash ?? 0;
    const psDelta = kasse(nachher, "P-S") - kasse(vorher, "P-S");
    const aaDelta = kasse(nachher, "A-A") - kasse(vorher, "A-A");
    expect(psDelta).toBe(-PREIS);
    expect(aaDelta).toBe(PREIS);
    expect(psDelta + aaDelta).toBe(0);
  });
});
