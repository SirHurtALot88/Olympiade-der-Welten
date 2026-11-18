/**
 * MEHRSPIELER-DELEGATION, Schreibrecht (Chris, 18.11., F1 „owner und host"): die Delegation eines
 * Teams aendern darf der Besitzer des Teams und der Host des Raums/Spielstands — sonst niemand.
 * Echter Guard, echte Route; nur die Sitzungs-Identitaet ausserhalb eines Raums wird gesetzt.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_ACTIVE_OWNER_ID,
  FRANKY_OWNER_ID,
  RAMONA_OWNER_ID,
  createChrisFrankyTeamControlSetting,
} from "@/lib/foundation/team-control-settings";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { resetDatabaseForTests } from "@/lib/persistence/sqlite";
import { erstelleCoopRaum, schreibKontext, type CoopRaum } from "@/tests/_helpers/coop-room-harness";

const resolveAuthoritativeWriteOwnerId = vi.fn(async (): Promise<string> => DEFAULT_ACTIVE_OWNER_ID);
vi.mock("@/lib/auth/session", () => ({ resolveAuthoritativeWriteOwnerId }));

const ZEIT = 120_000;

function anfrage(koerper: Record<string, unknown>) {
  return new Request("http://localhost/api/team-settings/control", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(koerper),
  });
}

const DELEGATION = { delegation: { stufe: "halbautomatik" } };

function baueSoloSaveMitRamonaTeam(name: string) {
  const persistence = createPersistenceService();
  const angelegt = persistence.createFreshSeasonOneSave({ name });
  const ramonaTeam = angelegt.gameState.teams[0]!;
  const chrisTeam = angelegt.gameState.teams[1]!;
  const settings = {
    ...angelegt.gameState.seasonState.teamControlSettings,
    [ramonaTeam.teamId]: { ...createChrisFrankyTeamControlSetting(ramonaTeam, "chris"), ownerId: RAMONA_OWNER_ID },
    [chrisTeam.teamId]: createChrisFrankyTeamControlSetting(chrisTeam, "chris"),
  };
  const gespeichert = persistence.saveSingleplayerState(angelegt.saveId, {
    ...angelegt.gameState,
    seasonState: { ...angelegt.gameState.seasonState, teamControlSettings: settings },
  });
  return { saveId: gespeichert.saveId, ramonaTeamId: ramonaTeam.teamId };
}

describe("Delegation aendern: Besitzer und Host (F1)", () => {
  beforeEach(() => {
    resolveAuthoritativeWriteOwnerId.mockImplementation(async () => DEFAULT_ACTIVE_OWNER_ID);
  });

  describe("ausserhalb eines Raums", () => {
    let saveId: string;
    let ramonaTeamId: string;
    beforeAll(() => {
      resetDatabaseForTests();
      ({ saveId, ramonaTeamId } = baueSoloSaveMitRamonaTeam("Delegation-Schreibrecht-Solo"));
    }, ZEIT);

    it("der Besitzer (Ramona) darf", async () => {
      resolveAuthoritativeWriteOwnerId.mockImplementation(async () => RAMONA_OWNER_ID);
      const { POST } = await import("@/app/api/team-settings/control/route");
      const antwort = await POST(anfrage({ saveId, teamId: ramonaTeamId, control: DELEGATION }));
      expect(antwort.status).toBe(200);
    }, ZEIT);

    it("der Host (Chris) darf", async () => {
      const { POST } = await import("@/app/api/team-settings/control/route");
      const antwort = await POST(anfrage({ saveId, teamId: ramonaTeamId, control: DELEGATION }));
      expect(antwort.status).toBe(200);
    }, ZEIT);

    it("ein anderer Spieler (Franky) darf nicht, auch nicht mit erfundener activeOwnerId", async () => {
      resolveAuthoritativeWriteOwnerId.mockImplementation(async () => FRANKY_OWNER_ID);
      const { POST } = await import("@/app/api/team-settings/control/route");
      const antwort = await POST(
        anfrage({ saveId, teamId: ramonaTeamId, control: DELEGATION, activeOwnerId: DEFAULT_ACTIVE_OWNER_ID }),
      );
      expect(antwort.status).toBe(403);
    }, ZEIT);
  });

  describe("im Raum", () => {
    let raum: CoopRaum;
    beforeAll(() => {
      resetDatabaseForTests();
      const saveId = createPersistenceService().createFreshSeasonOneSave({ name: "Delegation-Schreibrecht-Raum" }).saveId;
      raum = erstelleCoopRaum(saveId);
    }, ZEIT);

    it("der Besitzer darf (Franky auf seinem Team)", async () => {
      const { POST } = await import("@/app/api/team-settings/control/route");
      const antwort = await POST(
        anfrage({ saveId: raum.saveId, teamId: raum.frankysTeam, control: DELEGATION, ...schreibKontext(raum, raum.franky) }),
      );
      expect(antwort.status).toBe(200);
    }, ZEIT);

    it("der Host darf (Chris auf Frankys Team)", async () => {
      const { POST } = await import("@/app/api/team-settings/control/route");
      const antwort = await POST(
        anfrage({ saveId: raum.saveId, teamId: raum.frankysTeam, control: DELEGATION, ...schreibKontext(raum, raum.chris) }),
      );
      expect(antwort.status).toBe(200);
    }, ZEIT);

    it("ein anderer Spieler darf nicht (Franky auf Chris' Team)", async () => {
      const { POST } = await import("@/app/api/team-settings/control/route");
      const antwort = await POST(
        anfrage({ saveId: raum.saveId, teamId: raum.chrisTeam, control: DELEGATION, ...schreibKontext(raum, raum.franky) }),
      );
      expect(antwort.status).toBe(403);
    }, ZEIT);
  });
});
