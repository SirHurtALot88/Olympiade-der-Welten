import { afterEach, describe, expect, it } from "vitest";

import { buildNewGameStateFromBaseline } from "@/lib/game/new-game-setup-service";
import {
  staffelAufschlag,
  startbudgetMitStaffel,
  startbudgetStaffelAufschlag,
  startbudgetStaffelFuerNeuesSpiel,
} from "@/lib/resolve/startbudget-staffel";

const NOW = "2026-11-22T10:00:00.000Z";

function rangNachBudget(teams: Array<{ teamId: string; budget: number }>) {
  return [...teams].sort((a, b) => b.budget - a.budget || a.teamId.localeCompare(b.teamId)).map((t) => t.teamId);
}

describe("Startbudget-Staffel (22.11.)", () => {
  afterEach(() => {
    delete process.env.OLY_STARTBUDGET_STAFFEL;
  });

  it("Formel: Platz 32 = +20, Platz 16 = +52, Platz 1 = +82", () => {
    expect(staffelAufschlag(32, 32)).toBe(20);
    expect(staffelAufschlag(16, 32)).toBe(52);
    expect(staffelAufschlag(1, 32)).toBe(82);
  });

  it("neues Spiel: Kasse = Budget + Staffel je Platz, Summe +1.632, Budget-Basis und Rang unveraendert", () => {
    const { gameState } = buildNewGameStateFromBaseline({ presetId: "solo_1", now: NOW });
    const rang = rangNachBudget(gameState.teams);
    expect(rang).toHaveLength(32);
    let summe = 0;
    for (const platz of [1, 16, 32]) {
      const team = gameState.teams.find((t) => t.teamId === rang[platz - 1])!;
      expect(team.cash).toBeCloseTo(team.budget + 20 + 2 * (32 - platz), 6);
    }
    for (const team of gameState.teams) {
      summe += team.cash - team.budget;
      expect(startbudgetMitStaffel(gameState, team.teamId)).toBeCloseTo(team.cash, 6);
    }
    expect(summe).toBeCloseTo(1632, 6);
    // Basis unveraendert: Quelldaten 170..325 (Rang-/Stufenbasis), Kassen-Rang = Budget-Rang.
    const budgets = gameState.teams.map((t) => t.budget);
    expect(Math.min(...budgets)).toBe(170);
    expect(Math.max(...budgets)).toBe(325);
    expect(rangNachBudget(gameState.teams.map((t) => ({ teamId: t.teamId, budget: t.cash })))).toEqual(rang);
    // Stempel im Spielstand
    expect(gameState.seasonState.startbudgetStaffel?.regel).toBe("neu");
    expect(startbudgetStaffelAufschlag(gameState, rang[0]!)).toBe(82);
  }, 120_000);

  it("Vorschau zeigt die Startkasse, ohne die Rang-Basis zu verschieben", () => {
    const { preview, gameState } = buildNewGameStateFromBaseline({ presetId: "solo_1", now: NOW });
    for (const row of preview.teams) {
      const team = gameState.teams.find((t) => t.teamId === row.teamId)!;
      expect(row.budget).toBe(team.budget);
      expect(row.startkasse).toBeCloseTo(team.cash, 6);
    }
  }, 120_000);

  it("Schalter OLY_STARTBUDGET_STAFFEL=aus: Kasse = Budget wie bisher, Stempel 'alt'", () => {
    process.env.OLY_STARTBUDGET_STAFFEL = "aus";
    const { gameState } = buildNewGameStateFromBaseline({ presetId: "solo_1", now: NOW });
    expect(gameState.teams.every((t) => t.cash === t.budget)).toBe(true);
    expect(gameState.seasonState.startbudgetStaffel).toEqual({ regel: "alt", aufschlag: {} });
    expect(startbudgetStaffelFuerNeuesSpiel([{ teamId: "A", budget: 1 }]).regel).toBe("alt");
  }, 120_000);

  it("bestehender Spielstand ohne Stempel: Aufschlag 0", () => {
    expect(startbudgetStaffelAufschlag({ seasonState: {} }, "M-M")).toBe(0);
    expect(startbudgetStaffelAufschlag(null, "M-M")).toBe(0);
  });
});
