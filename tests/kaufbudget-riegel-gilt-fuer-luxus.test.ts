/**
 * DER VERHÄLTNIS-RIEGEL GILT FÜR LUXUS, NICHT FÜR DIE NOT.
 *
 * ENTSCHIEDEN VON CHRIS: „riegel umdrehen!"
 *
 * `teamNeedsTransferBudgetDeploy` verlangte ein Cash/Gehalt-Verhältnis von 1,15 und mindestens 45
 * Cash — aber NUR von Teams mit `rosterCount < playerOpt`. Die Prüfung traf damit genau die
 * Mannschaften, denen Spieler fehlen, und liess Teams auf oder über Opt unbehelligt.
 *
 * Das war eine Falle, die sich selbst zuzog: dünner Kader heisst wenige, dafür teure Spieler,
 * heisst schlechtes Cash/Gehalt-Verhältnis, heisst kein Kaufbudget, heisst dünner Kader.
 *
 * An Chris' Spielstand gemessen — von 25 Teams unter Opt hatten 5 Budget frei:
 *
 *     H-R   Kader  8 / Opt 12   Cash 64,4   Verhältnis 1,08   -> gesperrt
 *     L-K   Kader 10 / Opt 14   Cash 52,7   Verhältnis 0,96   -> gesperrt
 *     B-P   Kader  8 / Opt 11   Cash 40,5   Verhältnis 0,71   -> gesperrt
 *
 * H-R verfehlte die Schwelle um 0,07 — mit 64,4 Mio auf der Bank, vier Spielern unter Soll und
 * sieben Übermüdeten. Nach dem Umdrehen sind es 14 von 25, und die 47,9 Mio, die H-R immer hatte,
 * sind freigegeben.
 *
 * Die Höhe begrenzt weiterhin `spendable` (Cash minus Liquiditätsreserve) — der Riegel, der
 * wirklich vor Überkaufen schützt, und der die sechs Teams ohne jedes freie Geld weiter aussperrt.
 */
import { describe, expect, it } from "vitest";

import { teamNeedsTransferBudgetDeploy } from "@/lib/ai/ai-budget-deploy-service";
import type { GameState } from "@/lib/data/olyDataTypes";

/**
 * Ein Team mit viel Cash, hoher Gehaltslast und wählbarer Kadergrösse. Das Verhältnis
 * Cash/Gehalt liegt bewusst unter 1,15 — genau H-R's Lage.
 */
function baueTeam(input: { kader: number; opt: number; cash: number; gehaltJeSpieler: number }): GameState {
  return {
    season: { id: "season-2" },
    teams: [{ teamId: "T-1", shortCode: "T-1", cash: input.cash, name: "Team" }],
    teamIdentities: [{ teamId: "T-1", playerMin: 8, playerOpt: input.opt, playerMax: 14, finances: 9.5, ambition: 8 }],
    rosters: Array.from({ length: input.kader }, (_, index) => ({
      id: `r${index}`,
      teamId: "T-1",
      playerId: `p${index}`,
      salary: input.gehaltJeSpieler,
      upkeep: input.gehaltJeSpieler,
      contractLength: 2,
      currentValue: 18,
    })),
    players: Array.from({ length: input.kader }, (_, index) => ({
      id: `p${index}`,
      name: `P${index}`,
      marketValue: 18,
      displayMarketValue: 18,
      rating: 55,
      fatigue: 20,
      salary: input.gehaltJeSpieler,
    })),
    seasonState: {
      aiManagerBudgetReservations: {},
      seasonStrategyStates: {},
      teamStrategyProfiles: {},
    },
    transferHistory: [],
    disciplines: [],
    disciplineSchedule: [],
  } as unknown as GameState;
}

describe("Wer unter Opt steht, darf auffüllen", () => {
  it("ein Team unter Opt mit schlechtem Cash/Gehalt-Verhältnis bekommt Budget", () => {
    // H-R's Lage: acht Spieler bei Opt zwoelf, viel Cash, aber Verhaeltnis unter 1,15.
    const team = baueTeam({ kader: 8, opt: 12, cash: 64.4, gehaltJeSpieler: 7.4 });
    expect(teamNeedsTransferBudgetDeploy(team, "T-1", "season-2")).toBe(true);
  });

  it("auch knapp unter der alten Schwelle — der Fall, der um 0,07 scheiterte", () => {
    const team = baueTeam({ kader: 8, opt: 12, cash: 60, gehaltJeSpieler: 7 });
    const verhaeltnis = 60 / (8 * 7);
    expect(verhaeltnis).toBeLessThan(1.15);
    expect(teamNeedsTransferBudgetDeploy(team, "T-1", "season-2")).toBe(true);
  });
});

describe("Wer auf Opt ist, kauft Luxus — und dafür muss die Kasse stimmen", () => {
  it("ein Team auf Opt mit schlechtem Verhältnis bekommt KEIN Budget", () => {
    // Dieselbe Finanzlage, nur der Kader ist voll: jetzt greift der Riegel.
    const team = baueTeam({ kader: 12, opt: 12, cash: 64.4, gehaltJeSpieler: 7.4 });
    expect(teamNeedsTransferBudgetDeploy(team, "T-1", "season-2")).toBe(false);
  });

  it("zu wenig Cash sperrt ein volles Team ebenfalls", () => {
    const team = baueTeam({ kader: 12, opt: 12, cash: 40, gehaltJeSpieler: 2 });
    expect(teamNeedsTransferBudgetDeploy(team, "T-1", "season-2")).toBe(false);
  });
});

describe("Der Schutz vor Überkaufen bleibt", () => {
  it("ohne freies Geld gibt es auch unter Opt kein Budget", () => {
    // Die sechs Teams an Chris' Spielstand, die nach dem Umdrehen weiter aussen vor bleiben:
    // nicht weil ihr Verhaeltnis schlecht ist, sondern weil nach der Reserve nichts uebrig ist.
    const team = baueTeam({ kader: 8, opt: 12, cash: 0.5, gehaltJeSpieler: 7 });
    expect(teamNeedsTransferBudgetDeploy(team, "T-1", "season-2")).toBe(false);
  });
});
