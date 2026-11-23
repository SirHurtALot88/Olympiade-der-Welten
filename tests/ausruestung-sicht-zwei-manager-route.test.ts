/**
 * AUSRUESTUNG: SICHT ZWISCHEN ZWEI MENSCHEN ueber die echte Route (22.11., Mehrspieler-Pflicht).
 *
 * Chris und Franky steuern je ein Team. Die einzige Route, die einen GameState zum Browser schickt, ist
 * GET /api/singleplayer-state (Raum-Sockets und Raum-Snapshots tragen keinen GameState; Bestandsaufnahme im PR). Jeder bekommt dort
 * nur sein Lager, niemand die Saat. Schickt Franky seinen gefilterten Stand zurueck (PUT), bleibt Chris' Lager auf dem Server unveraendert.
 * Im Raum ist dieser generische PUT ohnehin gesperrt (`room_save_generic_write_forbidden`).
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { loadSeedData } from "@/lib/data/dataAdapter";
import { DEFAULT_ACTIVE_OWNER_ID, FRANKY_OWNER_ID } from "@/lib/foundation/team-control-settings";
import { leeresTeam, leseTeam, schreibeTeam, sichereAusruestung } from "@/lib/ausruestung/ausruestung-lager";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { createSaveRepository } from "@/lib/persistence/save-repository";
import { resetDatabaseForTests } from "@/lib/persistence/sqlite";
import { kontrolle } from "./ausruestung-hilfe";

const resolveSessionOwnerId = vi.fn(async (): Promise<string | null> => null);
vi.mock("@/lib/auth/session", async (orig) => ({ ...(await orig<typeof import("@/lib/auth/session")>()), resolveSessionOwnerId }));

let GET: typeof import("@/app/api/singleplayer-state/route").GET;
let PUT: typeof import("@/app/api/singleplayer-state/route").PUT;
beforeAll(async () => {
  ({ GET, PUT } = await import("@/app/api/singleplayer-state/route"));
}, 30000);

const SAVE_ID = "save-zwei-manager";

function legeSpielstandAn() {
  const repo = createSaveRepository();
  repo.createSaveFromSeed({ saveId: SAVE_ID, name: SAVE_ID, status: "archived", seedData: loadSeedData() });
  const persistence = createPersistenceService();
  const g0 = persistence.getSaveById(SAVE_ID)!.gameState;
  const [chrisTeam, frankyTeam, kiTeam] = g0.teams.map((t) => t.teamId) as [string, string, string];
  let g = {
    ...g0,
    seasonState: {
      ...g0.seasonState,
      teamControlSettings: {
        ...(g0.seasonState.teamControlSettings ?? {}),
        [chrisTeam]: kontrolle(chrisTeam, "manual", DEFAULT_ACTIVE_OWNER_ID),
        [frankyTeam]: kontrolle(frankyTeam, "manual", FRANKY_OWNER_ID),
        [kiTeam]: kontrolle(kiTeam, "ai", "ai"),
      },
    },
  };
  g = sichereAusruestung(g, "geheime-saat-xyz");
  g = schreibeTeam(g, chrisTeam, { ...leeresTeam(), ruhm: 111 });
  g = schreibeTeam(g, frankyTeam, { ...leeresTeam(), ruhm: 222 });
  g = schreibeTeam(g, kiTeam, { ...leeresTeam(), ruhm: 333 });
  persistence.saveSingleplayerState(SAVE_ID, g);
  return { chrisTeam, frankyTeam, kiTeam };
}

async function holeAls(ownerId: string) {
  resolveSessionOwnerId.mockResolvedValue(ownerId);
  const res = await GET(new Request(`http://localhost/api/singleplayer-state?saveId=${SAVE_ID}`));
  return (await res.json()).save.gameState;
}

describe("Ausruestung: zwei menschliche Manager ueber die Route", () => {
  beforeEach(() => {
    resetDatabaseForTests();
    resolveSessionOwnerId.mockReset();
  });
  afterEach(() => resetDatabaseForTests());

  it("jeder bekommt nur sein Lager, niemand die Saat", async () => {
    const { chrisTeam, frankyTeam, kiTeam } = legeSpielstandAn();
    const chris = await holeAls(DEFAULT_ACTIVE_OWNER_ID);
    const franky = await holeAls(FRANKY_OWNER_ID);
    expect(Object.keys(chris.ausruestung.teams)).toEqual([chrisTeam]);
    expect(Object.keys(franky.ausruestung.teams)).toEqual([frankyTeam]);
    expect(chris.ausruestung.teams[chrisTeam].ruhm).toBe(111);
    expect(franky.ausruestung.teams[frankyTeam].ruhm).toBe(222);
    for (const g of [chris, franky]) {
      expect(JSON.stringify(g.ausruestung)).not.toContain("geheime-saat-xyz");
      expect(g.ausruestung.saat).toBe("");
      expect(g.ausruestung.teams[kiTeam]).toBeUndefined();
    }
  }, 60_000);

  it("Franky schreibt seinen gefilterten Stand zurueck: Chris' Lager und die Saat bleiben unveraendert", async () => {
    const { chrisTeam, frankyTeam, kiTeam } = legeSpielstandAn();
    const franky = await holeAls(FRANKY_OWNER_ID);
    // Der Browser versucht zusaetzlich zu faelschen: eigenes Lager aufblasen, fremdes Lager hineinschreiben.
    franky.ausruestung.teams[frankyTeam].ruhm = 9999;
    franky.ausruestung.teams[chrisTeam] = { ...leeresTeam(), ruhm: 1 };
    franky.ausruestung.saat = "gefaelscht";
    const res = await PUT(
      new Request("http://localhost/api/singleplayer-state", {
        method: "PUT",
        body: JSON.stringify({ saveId: SAVE_ID, gameState: franky }),
      }),
    );
    expect(res.status).toBe(200);
    const gespeichert = createPersistenceService().getSaveById(SAVE_ID)!.gameState;
    expect(gespeichert.ausruestung!.saat).toBe("geheime-saat-xyz");
    expect(leseTeam(gespeichert, chrisTeam).ruhm).toBe(111);
    expect(leseTeam(gespeichert, frankyTeam).ruhm).toBe(222);
    expect(leseTeam(gespeichert, kiTeam).ruhm).toBe(333);
  }, 60_000);
});
