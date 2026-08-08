/**
 * GEMELDET (aus dem Sandbox-Lauf): der Sechs-Saisons-Lauf brach nach dem Saison-1-Draft ab mit
 * „Preflight blocked: negative_cash" (scripts/season1-autoprep.ts).
 *
 * BEFUND, in zwei Spielstaenden reproduziert: P-S landete bei cash = -2.26 bzw. -1.62. Ursache war
 * die Reihenfolge, nicht der Draft. Ein frischer Spielstand wird angelegt und IM SPEICHER gedraftet;
 * `ensureNulaOnProjectSuicide` lief aber erst beim naechsten Laden. Der Draft sah damit die vollen
 * 300 statt der 295.37 und verplante sie:
 *
 *     Budget 300.00  -  Draft 297.63  -  Nula 4.63  =  -2.26
 *
 * Die Kaufsperre war nie im Unrecht — zum Zeitpunkt des letzten Kaufs war das Geld noch da.
 *
 * CHRIS dazu: „P-S hat 300 aber kauft im Moment standardmaessig Nula das ist ok so!" Der Kauf bleibt
 * also unveraendert; er muss nur vor dem Draft feststehen.
 */
import { describe, expect, it } from "vitest";

import { createSaveGameState, loadFreshSeasonOneSeedData } from "@/lib/data/dataAdapter";

const NULA_ID = "player-2311-nula";
const PS = "P-S";

describe("Nula ist schon beim Anlegen bezahlt", () => {
  // Der Saison-1-Draft laeuft auf dem FRISCHEN Seed, nicht auf dem Standard-Seed. Im Standard-Seed
  // liegt Nula bereits bei P-S (der Transform ist dort ein No-op); nur im frischen Seed muss sie
  // gekauft und bezahlt werden — und genau dort trat der negative Kontostand auf.
  const save = createSaveGameState("test-nula-vor-draft", loadFreshSeasonOneSeedData());
  const ps = save.gameState.teams.find((team) => team.teamId === PS);

  it("P-S hat Nula direkt im Kader", () => {
    expect(save.gameState.rosters.some((entry) => entry.teamId === PS && entry.playerId === NULA_ID)).toBe(true);
  });

  it("und ihr Preis ist vom Konto abgezogen — der Draft plant damit mit dem echten Rest", () => {
    expect(ps).toBeDefined();
    const eintrag = save.gameState.rosters.find((entry) => entry.playerId === NULA_ID);
    const preis = eintrag?.purchasePrice ?? 0;
    expect(preis).toBeGreaterThan(0);
    // Genau der gemessene Fall: ohne diesen Abzug sah der Draft 300 statt 295.37.
    expect(ps!.cash).toBeCloseTo((ps!.budget ?? 0) - preis, 2);
  });

  it("kein Team startet mit negativem Konto", () => {
    expect(save.gameState.teams.filter((team) => (team.cash ?? 0) < 0)).toHaveLength(0);
  });
});
