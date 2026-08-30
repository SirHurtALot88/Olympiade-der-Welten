/**
 * B1: IST DER BATTLE-MODUS UEBER HTTP UEBERHAUPT ERREICHBAR?
 *
 * Bis hierher NICHT. `playMode` gab es nur als Parameter von `buildNewGameStateFromBaseline` —
 * `NewGameRequestBody`/`normalizeBody` (app/api/new-game/route.ts) kannten das Feld gar nicht, und
 * die Route ist der EINZIGE Weg, auf dem der Neuspiel-Assistent einen Spielstand anlegt. Der
 * Battle-Modus existierte damit ausschliesslich fuer direkte Funktionsaufrufe, also fuer Tests.
 * Chris' Vorgabe war „battle mode muss in allen modi verfügbar sein also solo und multiplayer".
 *
 * ANDERS ALS `tests/new-game-api.test.ts` laeuft hier der ECHTE Setup-Dienst — der Sinn der
 * Pruefung ist ja gerade, dass das Feld vom Rumpf bis in den gespeicherten Spielstand durchkommt.
 * Attrappiert wird nur der KI-Draft: er haengt hinten dran, dauert eine halbe Minute und hat mit
 * der Frage nichts zu tun.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { BATTLE_MODE_SPIELTAG_ANZAHL, BATTLE_MODE_TEAM_ANZAHL } from "@/lib/season/battle-mode-spielplan";

const kickoffLeagueSetupDraft = vi.fn();

vi.mock("@/lib/game/league-setup-draft-service", () => ({
  kickoffLeagueSetupDraft: (...args: unknown[]) => kickoffLeagueSetupDraft(...args),
}));

vi.mock("@/lib/auth/config", () => ({ isAuthEnabled: () => false }));

type Vorschau = {
  playMode: string;
  presetId: string;
  chrisTeamIds: string[];
  frankyTeamIds: string[];
  blockers: string[];
  warnings: string[];
  confirmToken: string;
  teams: Array<{ teamId: string }>;
  seasonSetup: { matchdayCount: number; scheduleCount: number };
};

async function post(body: Record<string, unknown>) {
  const { POST } = await import("@/app/api/new-game/route");
  const response = await POST(
    new Request("http://localhost:3000/api/new-game", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
  return {
    status: response.status,
    payload: (await response.json()) as {
      error?: string;
      preview?: Vorschau;
      result?: { save: { saveId: string; name: string }; preview: Vorschau };
    },
  };
}

beforeEach(() => {
  kickoffLeagueSetupDraft.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/new-game — playMode geht durch (B1)", () => {
  it("Vorschau mit playMode:battle liefert 16 Teams und 20 Spieltage", async () => {
    const { status, payload } = await post({ presetId: "online_4v4", playMode: "battle", dryRun: true });
    expect(status).toBe(200);
    const vorschau = payload.preview!;
    expect(vorschau.playMode).toBe("battle");
    expect(vorschau.teams).toHaveLength(BATTLE_MODE_TEAM_ANZAHL);
    expect(vorschau.seasonSetup.matchdayCount).toBe(BATTLE_MODE_SPIELTAG_ANZAHL);
    expect(vorschau.seasonSetup.scheduleCount).toBe(BATTLE_MODE_SPIELTAG_ANZAHL);
    expect(vorschau.chrisTeamIds).toHaveLength(4);
    expect(vorschau.frankyTeamIds).toHaveLength(4);
    expect(vorschau.blockers).toEqual([]);
  });

  it("Vorschau OHNE playMode bleibt Management — 32 Teams, 10 Spieltage, kein neues Feld noetig", async () => {
    const { payload } = await post({ presetId: "online_4v4", dryRun: true });
    const vorschau = payload.preview!;
    expect(vorschau.playMode).toBe("management");
    expect(vorschau.teams).toHaveLength(32);
    expect(vorschau.seasonSetup.matchdayCount).toBe(10);
  });

  it("Vorschau -> Anlegen: der gespeicherte Spielstand ist wirklich ein Battle-Save", async () => {
    const vorlauf = await post({ presetId: "online_4v4", playMode: "battle", dryRun: true });
    const token = vorlauf.payload.preview!.confirmToken;

    const { status, payload } = await post({
      presetId: "online_4v4",
      playMode: "battle",
      dryRun: false,
      confirmToken: token,
    });
    expect(status).toBe(200);

    const saveId = payload.result!.save.saveId;
    const gespeichert = createPersistenceService().getSaveById(saveId)!;
    expect(gespeichert.gameState.playMode).toBe("battle");
    expect(gespeichert.gameState.teams).toHaveLength(BATTLE_MODE_TEAM_ANZAHL);
    expect(gespeichert.gameState.season.matchdayIds).toHaveLength(BATTLE_MODE_SPIELTAG_ANZAHL);
    expect(gespeichert.gameState.seasonState.schedule ?? []).toHaveLength(160);

    // Der Draft haengt hinten dran und schliesst BEIDE menschlichen Teamsaetze aus.
    expect(kickoffLeagueSetupDraft).toHaveBeenCalledTimes(1);
    const [argumente] = kickoffLeagueSetupDraft.mock.calls[0]! as [{ saveId: string; excludeTeamIds: string[] }];
    expect(argumente.saveId).toBe(saveId);
    expect(argumente.excludeTeamIds).toHaveLength(8);
  });

  /**
   * DER BESTAETIGUNGSCODE TRAEGT DIE SPIELART (siehe `createConfirmToken`). Das ist keine
   * Kosmetik: ohne diese Trennung liesse sich ein in der Battle-Vorschau geholter Code fuer ein
   * MANAGEMENT-Neuspiel einloesen — der Spieler saehe 16 Teams und bekaeme 32.
   */
  it("ein Battle-Code laesst sich nicht fuer ein Management-Neuspiel einloesen", async () => {
    const battle = await post({ presetId: "solo_1", playMode: "battle", dryRun: true });
    const { status, payload } = await post({
      presetId: "solo_1",
      dryRun: false,
      confirmToken: battle.payload.preview!.confirmToken,
    });
    expect(status).toBe(409);
    expect(payload.error).toBe("new_game_setup_confirm_token_stale");
  });

  it("ein unbekannter playMode-Wert faellt auf Management zurueck statt zu scheitern", async () => {
    const { status, payload } = await post({ presetId: "solo_1", playMode: "quatsch", dryRun: true });
    expect(status).toBe(200);
    expect(payload.preview!.playMode).toBe("management");
    expect(payload.preview!.teams).toHaveLength(32);
  });
});
