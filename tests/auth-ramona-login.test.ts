import { readFileSync } from "node:fs";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AUTH_USERNAMES,
  authPasswordEnvVarName,
  getAuthUserConfig,
  verifyCredentials,
} from "@/lib/auth/config";
import { createSessionCookieValue, verifySession } from "@/lib/auth/session-cookie";
import {
  applyGameModeOwnership,
  applyChrisFrankyOwnershipToTeamControlSettings,
  canLocalUserManageTeam,
  DEFAULT_ACTIVE_OWNER_ID,
  deriveChrisFrankyTeamIdsFromSettings,
  FRANKY_OWNER_ID,
  getGameModeOwnershipLimits,
  RAMONA_OWNER_ID,
  withNormalizedTeamControlSettings,
} from "@/lib/foundation/team-control-settings";
import { resolveTeamDelegation } from "@/lib/foundation/team-delegation";
import { createFreshSeasonOneGameState } from "@/lib/game-state/singleplayer-state";

/**
 * RAMONA ALS DRITTE SPIELERIN (Chris, 18.11.): „Eigener Login für Ramona, mit denselben Rechten
 * wie Franky“, eigener Besitzer, Standard „Halbautomatik“, sobald ihr Teams gehoeren.
 */

const ROOT = path.resolve(__dirname, "..");

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Login fuer Ramona", () => {
  it("ist ein dritter fester Benutzer mit eigenem Besitzer", () => {
    expect(AUTH_USERNAMES).toEqual(["chris", "franky", "ramona"]);
    const ramona = getAuthUserConfig("Ramona");
    expect(ramona).toEqual({ username: "ramona", displayName: "Ramona", ownerId: RAMONA_OWNER_ID });
    expect(new Set(AUTH_USERNAMES.map((name) => getAuthUserConfig(name)?.ownerId)).size).toBe(3);
    expect(authPasswordEnvVarName("ramona")).toBe("OLY_USER_RAMONA_PASSWORD");
    expect(authPasswordEnvVarName("franky")).toBe("OLY_USER_FRANKY_PASSWORD");
  });

  it("prueft das Passwort aus OLY_USER_RAMONA_PASSWORD und verweigert in Produktion ohne Passwort", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("OLY_USER_RAMONA_PASSWORD", "");
    expect(verifyCredentials("ramona", "ramona")).toBeNull();

    vi.stubEnv("OLY_USER_RAMONA_PASSWORD", "geheim-fuer-test");
    expect(verifyCredentials("ramona", "geheim-fuer-test")?.ownerId).toBe(RAMONA_OWNER_ID);
    expect(verifyCredentials("ramona", "falsch")).toBeNull();
    // Ramonas Passwort oeffnet keinen anderen Benutzer.
    vi.stubEnv("OLY_USER_FRANKY_PASSWORD", "franky-test");
    expect(verifyCredentials("franky", "geheim-fuer-test")).toBeNull();
  });

  it("traegt die Sitzung mit Ramonas Besitzer-ID", () => {
    vi.stubEnv("NODE_ENV", "test");
    const cookie = createSessionCookieValue("ramona");
    expect(cookie).toBeTruthy();
    expect(verifySession(cookie)?.ownerId).toBe(RAMONA_OWNER_ID);
  });

  it("die Login-Auswahl und die Deploy-Dateien kennen Ramona", () => {
    const login = readFileSync(path.join(ROOT, "app/login/LoginFormClient.tsx"), "utf8");
    for (const name of AUTH_USERNAMES) {
      expect(login).toContain(`username: "${name}"`);
    }
    for (const datei of ["deploy/hetzner/docker-compose.yml", "deploy/hetzner/.env.example", ".env.example", "deploy/hetzner/README.md"]) {
      expect(readFileSync(path.join(ROOT, datei), "utf8")).toContain("OLY_USER_RAMONA_PASSWORD");
    }
  });
});

describe("Team-Zuordnung mit drei Menschen", () => {
  function dreiMenschen() {
    const base = createFreshSeasonOneGameState();
    const [chris, franky, ramona] = base.teams.map((team) => team.teamId);
    const gameState = applyGameModeOwnership(base, {
      saveMode: "custom",
      chrisTeamIds: [chris!],
      frankyTeamIds: [franky!],
      ramonaTeamIds: [ramona!],
    });
    return { gameState, chris: chris!, franky: franky!, ramona: ramona! };
  }

  it("Ramonas Teams gehoeren ihr, Standard Halbautomatik; Chris/Franky bleiben voll selbst", () => {
    const { gameState, chris, franky, ramona } = dreiMenschen();
    const settings = gameState.seasonState.teamControlSettings!;
    expect(deriveChrisFrankyTeamIdsFromSettings(gameState.teams, settings)).toEqual({
      chrisTeamIds: [chris],
      frankyTeamIds: [franky],
      ramonaTeamIds: [ramona],
    });
    expect(resolveTeamDelegation(settings[ramona]).stufe).toBe("halbautomatik");
    expect(resolveTeamDelegation(settings[chris]).stufe).toBe("voll_selbst");
    expect(resolveTeamDelegation(settings[franky]).stufe).toBe("voll_selbst");
    expect(gameState.scenarioMeta?.humanControlledTeamCount ?? 3).toBe(3);
    expect(getGameModeOwnershipLimits("custom").ramonaMax).toBe(4);
    expect(getGameModeOwnershipLimits("solo_1").ramonaMax).toBe(0);
  });

  it("Schreibschutz: jeder verwaltet nur seine eigenen Teams", () => {
    const { gameState, chris, franky, ramona } = dreiMenschen();
    expect(canLocalUserManageTeam(gameState, ramona, RAMONA_OWNER_ID)).toBe(true);
    expect(canLocalUserManageTeam(gameState, chris, RAMONA_OWNER_ID)).toBe(false);
    expect(canLocalUserManageTeam(gameState, franky, RAMONA_OWNER_ID)).toBe(false);
    expect(canLocalUserManageTeam(gameState, ramona, DEFAULT_ACTIVE_OWNER_ID)).toBe(false);
    expect(canLocalUserManageTeam(gameState, ramona, FRANKY_OWNER_ID)).toBe(false);
  });

  it("eine Umstellung zwischen Chris und Franky ohne Ramona-Liste laesst Ramonas Teams bei ihr", () => {
    const { gameState, chris, franky, ramona } = dreiMenschen();
    const next = applyChrisFrankyOwnershipToTeamControlSettings(
      gameState.teams,
      [franky],
      [chris],
      gameState.seasonState.teamControlSettings,
    );
    expect(next[ramona]?.ownerId).toBe(RAMONA_OWNER_ID);
    expect(next[ramona]?.delegation?.stufe).toBe("halbautomatik");
    // Laden/Normalisieren (inkl. Narben-Heilung) laesst sie ebenfalls stehen.
    const normalized = withNormalizedTeamControlSettings({
      ...gameState,
      seasonState: { ...gameState.seasonState, teamControlSettings: next },
    });
    expect(normalized.seasonState.teamControlSettings?.[ramona]?.ownerId).toBe(RAMONA_OWNER_ID);
  });

  it("wechselt ein Team von Ramona zu Chris, faellt die Halbautomatik weg", () => {
    const { gameState, chris, franky, ramona } = dreiMenschen();
    const next = applyChrisFrankyOwnershipToTeamControlSettings(
      gameState.teams,
      [chris, ramona],
      [franky],
      gameState.seasonState.teamControlSettings,
      [],
    );
    expect(next[ramona]?.ownerId).toBe(DEFAULT_ACTIVE_OWNER_ID);
    expect(next[ramona]?.delegation).toBeUndefined();
    expect(resolveTeamDelegation(next[ramona]).stufe).toBe("voll_selbst");
  });

  it("ein Spielstand ohne Ramona bleibt bytegleich in den Steuerungsfeldern", () => {
    const base = createFreshSeasonOneGameState();
    const [chris, franky] = base.teams.map((team) => team.teamId);
    const gameState = applyGameModeOwnership(base, { saveMode: "custom", chrisTeamIds: [chris!], frankyTeamIds: [franky!] });
    const settings = gameState.seasonState.teamControlSettings!;
    expect(Object.values(settings).some((entry) => "delegation" in entry)).toBe(false);
  });
});
