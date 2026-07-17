import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createFreshSeasonOneGameState } from "@/lib/game-state/singleplayer-state";
import {
  persistFoundationManagerTeamId,
  readStoredFoundationManagerTeamId,
  resolvePreferredFoundationTeamContext,
} from "@/lib/foundation/tabs/foundation-page-module-helpers";

// #183: Beim Laden eines Speicherstands muss das aktive (menschlich gesteuerte)
// Team des Saves wiederhergestellt werden. Die browser-globale
// localStorage-Praeferenz darf NICHT ueber Save-Grenzen hinweg lecken: sonst
// startet man frisch mit Team A und der Load oeffnet auf Team B (dem aktiven
// Team eines vorher gespielten Saves), weil beide Saves dieselbe 32-Team-Liga
// teilen und die alte teamId weiterhin gueltig ist.

function installFakeWindow(href = "http://localhost/foundation") {
  const store = new Map<string, string>();
  const fakeWindow = {
    location: { href },
    localStorage: {
      getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => {
        store.clear();
      },
    },
  };
  (globalThis as unknown as { window?: unknown }).window = fakeWindow;
  return fakeWindow;
}

describe("foundation active manager team resolution (#183)", () => {
  const gameState = createFreshSeasonOneGameState();
  const teams = gameState.teams;
  const teamA = teams[0]!;
  const teamB = teams[1]!;

  beforeEach(() => {
    installFakeWindow();
  });

  afterEach(() => {
    delete (globalThis as unknown as { window?: unknown }).window;
  });

  it("does not return a stored preference that belongs to a different save", () => {
    persistFoundationManagerTeamId(teamB.teamId, "save-other", "manual_select");

    // Für den aktuell geladenen Save darf die Fremd-Praeferenz nicht gelten.
    expect(readStoredFoundationManagerTeamId(teams, "save-current")).toBeNull();
    // Für den passenden Save wird sie weiterhin honoriert.
    expect(readStoredFoundationManagerTeamId(teams, "save-other")).toBe(teamB.teamId);
  });

  it("prefers the save's own controlled team over a cross-save localStorage preference", () => {
    // Vorheriger Save hatte Team B aktiv -> global gemerkt.
    persistFoundationManagerTeamId(teamB.teamId, "save-other", "manual_select");

    // Neuer Save: der Mensch steuert Team A (im Save persistiert).
    const context = resolvePreferredFoundationTeamContext(teams, {
      savedTeamId: teamA.teamId,
      activeSaveId: "save-current",
    });

    expect(context.teamId).toBe(teamA.teamId);
    expect(context.teamId).not.toBe(teamB.teamId);
  });

  it("ignores the stale cross-save preference and falls back to the human team", () => {
    persistFoundationManagerTeamId(teamB.teamId, "save-other", "manual_select");

    // Kein savedTeamId übergeben -> die Save-gescopte Praeferenz greift nicht,
    // also faellt es auf das Standard-Manager-Team (menschlich gesteuert) zurueck,
    // nicht auf das Fremd-Team B.
    const context = resolvePreferredFoundationTeamContext(teams, {
      activeSaveId: "save-current",
      settingsMap: gameState.seasonState.teamControlSettings,
    });

    expect(context.teamId).not.toBe(teamB.teamId);
    expect(context.source).toBe("default_human_team");
  });
});
