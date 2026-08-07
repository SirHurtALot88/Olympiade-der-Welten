/**
 * DIE SAISONENDE-STATION HAT EINEN EIGENEN NAMEN.
 *
 * Bis 0.4.11 hiess sie `preseason_management` — genau wie der frische Spielaufbau. Ein Name fuer
 * zwei gegenteilige Zeitpunkte, und daraus sind zwei gemeldete Fehler entstanden: der Setup-Draft
 * lief am Saisonende erneut und kaufte Kader voll, die laengst spielten (Client 135a9a4f, Server
 * 8f2bba10). Beide Male war die Bedingung „gamePhase === preseason_management" gemeint als
 * „frischer Aufbau" und traf am Saisonende genauso zu.
 *
 * Diese Suite haelt die Trennung fest.
 */
import { describe, expect, it } from "vitest";

import { SEASON_TRANSITION_STEPS } from "@/lib/season/season-transition-steps";
import {
  getPhaseAfterStep,
  isSeasonEndPhase,
  migrateLegacyPreseasonManagementPhase,
} from "@/lib/season/season-transition-chain";

describe("Saisonende-Station: eigener Name", () => {
  it("fuehrt die Kette ueber season_end_management statt ueber preseason_management", () => {
    expect(getPhaseAfterStep("player_development")).toBe("season_end_management");
    expect(getPhaseAfterStep("season_end_management")).toBe("transfer_sell_phase");
    expect(SEASON_TRANSITION_STEPS).toContain("season_end_management");
    expect(SEASON_TRANSITION_STEPS).not.toContain("preseason_management");
  });

  it("zaehlt nur die neue Station zum Saisonende — der frische Aufbau gehoert nicht dazu", () => {
    expect(isSeasonEndPhase("season_end_management")).toBe(true);
    // Der Kern der Trennung: `preseason_management` ist KEIN Saisonende mehr. Genau daran haengen
    // der KI-Kauf-Riegel (`ai-transfer-window-session-service`) und der Setup-Draft-Riegel.
    expect(isSeasonEndPhase("preseason_management")).toBe(false);
    expect(isSeasonEndPhase("season_active")).toBe(false);
  });

  it("laesst die uebrigen Stationen der Kette unveraendert Saisonende sein", () => {
    for (const phase of ["season_completed", "transfer_sell_phase", "transfer_buy_phase", "lineup_setup"] as const) {
      expect(isSeasonEndPhase(phase), `${phase} muss Saisonende bleiben`).toBe(true);
    }
  });
});

describe("Altstand-Umschrift beim Laden", () => {
  const gespielt = [{ seasonId: "season-3" }];

  it("schreibt einen Altstand MIT Spieltagsergebnis auf die neue Station um", () => {
    expect(
      migrateLegacyPreseasonManagementPhase({
        gamePhase: "preseason_management",
        seasonId: "season-3",
        matchdayResults: gespielt,
      }),
    ).toBe("season_end_management");
  });

  it("laesst einen Altstand OHNE Spieltagsergebnis stehen — das ist der festhaengende Neustart", () => {
    expect(
      migrateLegacyPreseasonManagementPhase({
        gamePhase: "preseason_management",
        seasonId: "season-1",
        matchdayResults: [],
      }),
    ).toBe("preseason_management");
    expect(
      migrateLegacyPreseasonManagementPhase({
        gamePhase: "preseason_management",
        seasonId: "season-1",
        matchdayResults: undefined,
      }),
    ).toBe("preseason_management");
  });

  it("zaehlt nur Ergebnisse DIESER Saison — ein Vorsaison-Ergebnis macht keinen Saisonabschluss", () => {
    expect(
      migrateLegacyPreseasonManagementPhase({
        gamePhase: "preseason_management",
        seasonId: "season-4",
        matchdayResults: gespielt,
      }),
    ).toBe("preseason_management");
  });

  it("fasst keine andere Phase an", () => {
    expect(
      migrateLegacyPreseasonManagementPhase({
        gamePhase: "season_active",
        seasonId: "season-3",
        matchdayResults: gespielt,
      }),
    ).toBe("season_active");
    expect(
      migrateLegacyPreseasonManagementPhase({ gamePhase: undefined, seasonId: "season-3", matchdayResults: gespielt }),
    ).toBeUndefined();
  });
});
