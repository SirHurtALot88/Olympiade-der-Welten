import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createFreshSeasonOneGameState } from "@/lib/game-state/singleplayer-state";
import { applyGameModeOwnership } from "@/lib/foundation/team-control-settings";
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

// Owner-reported bug: on LOAD the active team was NOT the human-owned team --
// a stale/AI `team=` URL param (e.g. team=R-C carried over from a previous
// save/session) was honored unconditionally, stranding the player on an AI club
// they could not manage. On load a non-owned selection must snap to the owned team.
describe("foundation active manager team resolution (owned-team guard on load)", () => {
  const baseGameState = createFreshSeasonOneGameState();
  const teams = baseGameState.teams;
  const aiTeam = teams[0]!; // AI-controlled after ownership below
  const ownedTeam = teams[1]!;
  const secondOwnedTeam = teams[2]!;

  function withChrisOwnership(chrisTeamIds: string[]) {
    return applyGameModeOwnership(baseGameState, {
      saveMode: chrisTeamIds.length > 1 ? "solo_2" : "solo_1",
      chrisTeamIds,
      frankyTeamIds: [],
    });
  }

  afterEach(() => {
    delete (globalThis as unknown as { window?: unknown }).window;
  });

  it("overrides a stale AI team= URL param with the human-owned team (single-owned save)", () => {
    const owned = withChrisOwnership([ownedTeam.teamId]);
    installFakeWindow(`http://localhost/foundation?team=${encodeURIComponent(aiTeam.teamId)}`);

    const context = resolvePreferredFoundationTeamContext(owned.teams, {
      initialTeamId: aiTeam.teamId,
      activeSaveId: "save-owner",
      settingsMap: owned.seasonState.teamControlSettings,
    });

    expect(context.teamId).toBe(ownedTeam.teamId);
    expect(context.teamId).not.toBe(aiTeam.teamId);
    expect(context.source).toBe("default_human_team");
  });

  it("overrides an AI initial/route prop selection with the owned team when no URL param is present", () => {
    const owned = withChrisOwnership([ownedTeam.teamId]);
    installFakeWindow("http://localhost/foundation");

    const context = resolvePreferredFoundationTeamContext(owned.teams, {
      initialTeamId: aiTeam.teamId,
      activeSaveId: "save-owner",
      settingsMap: owned.seasonState.teamControlSettings,
    });

    expect(context.teamId).toBe(ownedTeam.teamId);
    expect(context.source).toBe("default_human_team");
  });

  it("keeps a URL selection that points at one of the human's own teams (multi-owned save)", () => {
    const owned = withChrisOwnership([ownedTeam.teamId, secondOwnedTeam.teamId]);
    installFakeWindow(`http://localhost/foundation?team=${encodeURIComponent(secondOwnedTeam.teamId)}`);

    const context = resolvePreferredFoundationTeamContext(owned.teams, {
      activeSaveId: "save-owner",
      settingsMap: owned.seasonState.teamControlSettings,
    });

    expect(context.teamId).toBe(secondOwnedTeam.teamId);
    expect(context.source).toBe("route");
  });

  it("snaps an AI URL param to the primary owned team in a multi-owned save", () => {
    const owned = withChrisOwnership([ownedTeam.teamId, secondOwnedTeam.teamId]);
    installFakeWindow(`http://localhost/foundation?team=${encodeURIComponent(aiTeam.teamId)}`);

    const context = resolvePreferredFoundationTeamContext(owned.teams, {
      activeSaveId: "save-owner",
      settingsMap: owned.seasonState.teamControlSettings,
    });

    // Primary owned team = first Chris-owned team.
    expect(context.teamId).toBe(ownedTeam.teamId);
    expect(context.source).toBe("default_human_team");
  });

  it("leaves the route selection untouched when the save has no owned team (AI-only state)", () => {
    installFakeWindow(`http://localhost/foundation?team=${encodeURIComponent(aiTeam.teamId)}`);

    const context = resolvePreferredFoundationTeamContext(baseGameState.teams, {
      activeSaveId: "save-ai-only",
      settingsMap: baseGameState.seasonState.teamControlSettings,
    });

    expect(context.teamId).toBe(aiTeam.teamId);
    expect(context.source).toBe("route");
  });
});
