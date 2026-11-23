/**
 * MARKETING, Aushaengeschild waehlen (23.11.): der Schreibweg `POST /api/marketing` laeuft durch `authorizeServerRoomWrite`; nur der Manager des
 * Teams darf waehlen (Franky auf seinem Team ja, Franky auf Chris' Team 403), die Wahl steht je Team getrennt im Spielstand und ist gesperrt.
 */
import { beforeAll, describe, expect, it, vi } from "vitest";

import { DEFAULT_ACTIVE_OWNER_ID } from "@/lib/foundation/team-control-settings";
import { stempleFinanzenJeSpieltagBeimAnlegen } from "@/lib/finance/finanzen-je-spieltag";
import { stempleMarketingBeimAnlegen } from "@/lib/marketing/marketing-regel";
import { besteSechs } from "@/lib/marketing/marketing-kontext";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { resetDatabaseForTests } from "@/lib/persistence/sqlite";
import { erstelleCoopRaum, schreibKontext, type CoopRaum } from "@/tests/_helpers/coop-room-harness";

const resolveAuthoritativeWriteOwnerId = vi.fn(async (): Promise<string> => DEFAULT_ACTIVE_OWNER_ID);
vi.mock("@/lib/auth/session", () => ({ resolveAuthoritativeWriteOwnerId }));

const ZEIT = 120_000;

function anfrage(koerper: Record<string, unknown>) {
  return new Request("http://localhost/api/marketing", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(koerper),
  });
}

describe("POST /api/marketing: Aushaengeschild", () => {
  let raum: CoopRaum;
  let frankyKandidat = "";
  beforeAll(() => {
    resetDatabaseForTests();
    const persistence = createPersistenceService();
    const angelegt = persistence.createFreshSeasonOneSave({ name: "Marketing-Schreibrecht" });
    raum = erstelleCoopRaum(angelegt.saveId);
    // Kader sicherstellen (ein frischer Spielstand ist noch ungedraftet): acht Spieler je Team.
    const save = persistence.getSaveById(raum.saveId)!;
    const gs = save.gameState;
    const belegt = new Set(gs.rosters.map((r) => r.playerId));
    const frei = gs.players.filter((p) => !belegt.has(p.id));
    const rosters = [...gs.rosters];
    let z = 0;
    for (const teamId of [raum.chrisTeam, raum.frankysTeam]) {
      if (rosters.filter((r) => r.teamId === teamId).length >= 6) continue;
      for (let i = 0; i < 8; i += 1) {
        rosters.push({
          id: `route-${teamId}-${i}`, teamId, playerId: frei[z++]!.id, contractLength: 3, salary: 6, upkeep: 6, purchasePrice: 10, currentValue: 10, roleTag: "bench", joinedSeasonId: gs.season.id,
        });
      }
    }
    const gespeichert = persistence.saveSingleplayerState(raum.saveId, stempleMarketingBeimAnlegen(stempleFinanzenJeSpieltagBeimAnlegen({ ...gs, rosters, seasonState: { ...gs.seasonState, marketingRegel: null } })));
    frankyKandidat = besteSechs(gespeichert.gameState, raum.frankysTeam)[0]!.player.id;
  }, ZEIT);

  it("ein anderer Mensch darf auf Chris' Team nicht schreiben (403), der Spielstand bleibt unberuehrt", async () => {
    const { POST } = await import("@/app/api/marketing/route");
    const antwort = await POST(anfrage({ saveId: raum.saveId, teamId: raum.chrisTeam, aktion: "aushaengeschild", playerId: frankyKandidat, ...schreibKontext(raum, raum.franky) }));
    expect(antwort.status).toBe(403);
    expect(createPersistenceService().getSaveById(raum.saveId)!.gameState.seasonState.marketingAushaengeschild?.[raum.chrisTeam]).toBeUndefined();
  }, ZEIT);

  it("der Manager des Teams waehlt (Franky auf seinem Team); die Wahl ist gesperrt und je Team getrennt", async () => {
    const { POST } = await import("@/app/api/marketing/route");
    const antwort = await POST(anfrage({ saveId: raum.saveId, teamId: raum.frankysTeam, aktion: "aushaengeschild", playerId: frankyKandidat, ...schreibKontext(raum, raum.franky) }));
    const roh = await antwort.clone().json();
    expect(roh.reason, JSON.stringify(roh)).toBeNull();
    expect(antwort.status).toBe(200);
    const gs = createPersistenceService().getSaveById(raum.saveId)!.gameState;
    expect(gs.seasonState.marketingAushaengeschild?.[raum.frankysTeam]).toMatchObject({ playerId: frankyKandidat, gesperrt: true, von: "mensch" });
    expect(gs.seasonState.marketingAushaengeschild?.[raum.chrisTeam]).toBeUndefined();
    const nochmal = await POST(anfrage({ saveId: raum.saveId, teamId: raum.frankysTeam, aktion: "aushaengeschild", playerId: frankyKandidat, ...schreibKontext(raum, raum.franky) }));
    expect(nochmal.status).toBe(400);
    expect((await nochmal.json()).reason).toBe("gesperrt");
  }, ZEIT);
});
