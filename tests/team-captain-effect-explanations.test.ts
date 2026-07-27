import { describe, expect, it } from "vitest";

import type { TeamCaptainRecord } from "@/lib/data/olyDataTypes";
import { BOARD_V2_CAPTAIN } from "@/lib/board/board-objectives-config";
import { CAPTAIN_TEAM_POWER_EFFECT_FACTOR } from "@/lib/lineups/team-powers";
import { buildCaptainEffectExplanations } from "@/lib/morale/team-captain-service";

/** Dreamscape aus dem echten Save: Führung ~75,6 → Power-Rohwert am Cap (8). */
function captain(partial?: Partial<TeamCaptainRecord>): TeamCaptainRecord {
  return {
    seasonId: "season-1",
    teamId: "C-C",
    playerId: "p-dreamscape",
    playerName: "Dreamscape",
    leadershipScore: 75.6,
    style: "inspirer",
    effects: {
      moraleBuffer: 4.2,
      rivalryPressureReductionPct: 21.6,
      teamPowerModifierPct: 8,
      conflictSoftenChancePct: 30.2,
    },
    traitSignals: [],
    source: "manual_assignment",
    ...partial,
  };
}

describe("captain effect explanations", () => {
  it("shows the EFFECTIVE team power bonus, not the raw chip value", () => {
    // Der Chip zeigte "+8 %", real fliessen davon nur 25 % in die Team-Power.
    const teamPower = buildCaptainEffectExplanations(captain()).find((row) => row.key === "teamPower");
    expect(teamPower?.displayValue).toBe(`+${(8 * CAPTAIN_TEAM_POWER_EFFECT_FACTOR).toFixed(1).replace(".", ",")} %`);
    expect(teamPower?.displayValue).toBe("+2,0 %");
    // Der Rohwert bleibt in der Herleitung sichtbar, damit die Viertelung nachvollziehbar ist.
    expect(teamPower?.formula).toContain("8,0");
  });

  it("names the condition without which the team power bonus does nothing", () => {
    const teamPower = buildCaptainEffectExplanations(captain()).find((row) => row.key === "teamPower");
    expect(teamPower?.caveat).toMatch(/nur.*Team-Power/i);
  });

  it("surfaces the board pressure damping that the chips omitted entirely", () => {
    const board = buildCaptainEffectExplanations(captain()).find((row) => row.key === "boardPressure");
    // 75,6 / 40 = 1,89 — unter dem Deckel von 2,0.
    expect(board?.displayValue).toBe("−1,9");
    expect(board?.appliesTo).toMatch(/Vorstand/i);
  });

  it("caps the board damping at the configured maximum", () => {
    const board = buildCaptainEffectExplanations(captain({ leadershipScore: 400 })).find(
      (row) => row.key === "boardPressure",
    );
    expect(board?.displayValue).toBe(`−${BOARD_V2_CAPTAIN.maxDamp.toFixed(1).replace(".", ",")}`);
  });

  it("keeps rivalry pressure distinct from board pressure", () => {
    const rows = buildCaptainEffectExplanations(captain());
    const rivalry = rows.find((row) => row.key === "rivalry");
    expect(rivalry?.displayValue).toBe("−21,6 %");
    // Genau diese Verwechslung war der Anlass — der Hinweis muss stehen bleiben.
    expect(rivalry?.caveat).toMatch(/nicht der Vorstands-Druck/i);
  });

  it("does not advertise the unwired conflict-soften effect", () => {
    // `conflictSoftenChancePct` wird berechnet und gespeichert, aber von keiner
    // Spiellogik gelesen — es darf deshalb nicht als Wirkung erscheinen.
    const rows = buildCaptainEffectExplanations(captain());
    expect(rows.map((row) => row.key)).toEqual(["morale", "rivalry", "boardPressure", "teamPower"]);
    expect(JSON.stringify(rows)).not.toMatch(/konflikt/i);
  });

  it("derives every value from the leadership score", () => {
    const rows = buildCaptainEffectExplanations(captain());
    for (const row of rows) {
      expect(row.formula).toContain("Führung 75,6");
      expect(row.tooltip).toContain(row.label);
      expect(row.tooltip).toContain("Herleitung:");
    }
  });

  it("scales with a weaker captain", () => {
    const weak = buildCaptainEffectExplanations(
      captain({
        leadershipScore: 18,
        effects: { moraleBuffer: 1, rivalryPressureReductionPct: 5.1, teamPowerModifierPct: 2, conflictSoftenChancePct: 7.2 },
      }),
    );
    expect(weak.find((row) => row.key === "teamPower")?.displayValue).toBe("+0,5 %");
    expect(weak.find((row) => row.key === "boardPressure")?.displayValue).toBe("−0,5");
  });
});
