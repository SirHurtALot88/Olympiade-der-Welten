import { describe, expect, it } from "vitest";

import {
  TEAM_POWERS_ENABLED,
  areTeamPowersEnabled,
  calculatePassiveTeamPowerBonus,
  calculateTeamPowerModifierForSide,
  getTeamPowerOptions,
  type LegacyTeamPowerOption,
} from "@/lib/lineups/team-powers";

// Team-Powers sind auf Wunsch vorerst abgeschaltet: sie sollen weder in die Arena-Scores
// einfliessen noch irgendwo angezeigt werden. Diese Suite haelt den Aus-Zustand fest —
// ohne sie koennte der Schalter unbemerkt zurueckkippen.

function power(partial?: Partial<LegacyTeamPowerOption>): LegacyTeamPowerOption {
  return {
    id: "power-1",
    label: "Warpath Power Surge",
    description: "Test",
    category: "flex",
    effectType: "self_boost",
    targetMode: "self",
    targetLimit: 0,
    conditionalBonusPct: 0,
    conditionalTrigger: null,
    conditionalDescription: null,
    source: "team_identity",
    sourceFacilityId: null,
    modifier: 6,
    positiveAttributeTags: ["power", "torment"],
    negativeAttributeTag: "awareness",
    chargesTotal: 4,
    chargesUsed: 0,
    chargesRemaining: 4,
    selectedForSeason: true,
    isUsedUp: false,
    isPassive: false,
    ...partial,
  };
}

describe("Team-Powers sind abgeschaltet", () => {
  it("steht der Schalter auf aus", () => {
    expect(TEAM_POWERS_ENABLED).toBe(false);
    expect(areTeamPowersEnabled()).toBe(false);
  });

  it("liefert keine Auswahl — damit verschwindet auch die Anzeige", () => {
    const gameState = {
      seasonState: {
        teamPowers: [
          { id: "power-1", seasonId: "season-1", teamId: "C-C", selectedForSeason: true, chargesTotal: 4 },
        ],
      },
    } as never;

    expect(getTeamPowerOptions({ gameState, seasonId: "season-1", teamId: "C-C" })).toEqual([]);
  });

  it("traegt nichts zum Score bei, auch wenn ein Draft noch eine Power gespeichert hat", () => {
    // Gespeicherte teamPowerIds bleiben liegen (kein Migrationsbedarf) — sie duerfen nur
    // nicht mehr wirken.
    const result = calculateTeamPowerModifierForSide({
      modifiers: { d1: { teamPowerId: "power-1" }, d2: {} } as never,
      disciplineSide: "d1",
      disciplineCategory: "power",
      teamPowers: [power()],
    });

    expect(result.teamPowerModifier).toBe(0);
    expect(result.teamPowerLabel).toBeNull();
    // Der Impact steuert die Debuff-Aufloesung: nur Quellen mit teamPowerImpact > 0
    // werden in applyTeamPowerDebuffs gesammelt. 0 heisst also auch: keine Debuffs.
    expect(result.teamPowerImpact).toBe(0);
    expect(result.teamPowerSelected).toBe(0);
    // Eine abgeschaltete Mechanik ist kein Fehlerfall — keine Warnung an den Spieler.
    expect(result.warnings).toEqual([]);
  });

  it("gibt keinen Passiv-Bonus mehr", () => {
    expect(calculatePassiveTeamPowerBonus([power({ isPassive: true })], "power")).toBe(0);
  });
});
