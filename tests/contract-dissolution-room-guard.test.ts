/**
 * VERTRAGSAUFLOESUNG IM COOP — die Route schrieb ohne jede Besitzpruefung.
 *
 * Gefunden ueber `tests/api-write-route-guard-coverage.test.ts`: von 48 schreibenden API-Routen
 * war `contracts/dissolution` die einzige ECHTE Gameplay-Schreibroute ohne
 * `authorizeServerRoomWrite`. Im Coop hiess das: jeder konnte die Aufloesung eines FREMDEN Teams
 * entscheiden, und der Mitspieler bekam davon nichts mit — kein Broadcast, also ein Kader, in dem
 * der Spieler noch stand, und ein Kontostand ohne die Abfindung.
 *
 * WARUM DIESER TEST UND NICHT NUR DER ABDECKUNGS-SCAN: jener prueft per Textsuche, ob der Aufruf
 * in der Datei STEHT. Ob er richtig verdrahtet ist — richtiges Team, richtige Aktion, und ob eine
 * Ablehnung den Schreibvorgang tatsaechlich verhindert — sagt er nicht. Genau diese Luecke ist im
 * Coop-Absicherungsplan als Hauptmangel benannt: mehrere Routen-Tests mocken den Guard auf
 * "erlaubt immer", womit die Verdrahtung unbewiesen bleibt.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const authorizeServerRoomWrite = vi.fn();
const notifyRoomGameplayWrite = vi.fn();
const executeLocalContractDissolution = vi.fn();

vi.mock("@/lib/room/server-authoritative-write-guard", () => ({ authorizeServerRoomWrite }));
vi.mock("@/lib/room/room-gameplay-write-notifier", () => ({ notifyRoomGameplayWrite }));
vi.mock("@/lib/morale/contract-dissolution-local-service", () => ({
  executeLocalContractDissolution,
  listLocalContractDissolutionOffers: vi.fn(() => []),
}));

const anfrage = (zusatz: Record<string, unknown> = {}) =>
  new Request("http://localhost/api/contracts/dissolution", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      saveId: "raum-save",
      seasonId: "season-1",
      teamId: "A-A",
      playerId: "p-1",
      decision: "accepted",
      ...zusatz,
    }),
  });

describe("Vertragsaufloesung: der Raum-Guard schuetzt wirklich", () => {
  beforeEach(() => {
    authorizeServerRoomWrite.mockReset();
    notifyRoomGameplayWrite.mockReset();
    executeLocalContractDissolution.mockReset();
    executeLocalContractDissolution.mockReturnValue({ ok: true, offers: [], applied: null });
  });

  it("laesst den Guard ueber DAS TEAM entscheiden, dessen Spieler geht", async () => {
    // Die Verdrahtung ist der Kern: ohne `teamId` pruefte der Guard gar keine Zugehoerigkeit,
    // und ein Aufruf mit falscher Aktion meldete dem Mitspieler das Falsche.
    authorizeServerRoomWrite.mockReturnValue({ allowed: true, status: 200, reason: "ok", warnings: [] });
    const { POST } = await import("@/app/api/contracts/dissolution/route");
    await POST(anfrage({ roomCode: "ABCD", participantId: "teilnehmer-1" }));

    expect(authorizeServerRoomWrite).toHaveBeenCalledWith(
      expect.objectContaining({
        saveId: "raum-save",
        teamId: "A-A",
        action: "contract_dissolution",
        roomCode: "ABCD",
        participantId: "teilnehmer-1",
      }),
    );
  }, 15000);

  it("eine Ablehnung verhindert den Schreibvorgang — nicht nur die Antwort", async () => {
    // DER EIGENTLICHE PUNKT. Ein Guard, der zwar 403 zurueckgibt, aber vorher schon geschrieben
    // hat, schuetzt nichts. Deshalb wird hier geprueft, dass der Dienst GAR NICHT laeuft.
    authorizeServerRoomWrite.mockReturnValue({
      allowed: false,
      status: 403,
      reason: "participant_has_no_team_ownership",
      warnings: [],
    });
    const { POST } = await import("@/app/api/contracts/dissolution/route");
    const antwort = await POST(anfrage({ roomCode: "ABCD", participantId: "fremder" }));

    expect(antwort.status).toBe(403);
    expect(executeLocalContractDissolution).not.toHaveBeenCalled();
    // Und es darf auch nichts gemeldet werden — sonst zeigte die Oberflaeche des Mitspielers eine
    // Aenderung an, die nie stattgefunden hat.
    expect(notifyRoomGameplayWrite).not.toHaveBeenCalled();
    await expect(antwort.json()).resolves.toMatchObject({ success: false, error: "participant_has_no_team_ownership" });
  }, 15000);

  it("bei Erfolg erfaehrt der Mitspieler davon", async () => {
    // Ohne Broadcast steht der Spieler beim Mitspieler weiter im Kader und die Abfindung fehlt
    // auf dem Kontostand — die Haelfte des Fehlers, die man erst spaeter bemerkt.
    authorizeServerRoomWrite.mockReturnValue({ allowed: true, status: 200, reason: "ok", warnings: [] });
    const { POST } = await import("@/app/api/contracts/dissolution/route");
    await POST(anfrage({ roomCode: "ABCD", participantId: "teilnehmer-1" }));

    expect(notifyRoomGameplayWrite).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        saveId: "raum-save",
        teamId: "A-A",
        action: "contract_dissolution",
        eventType: "roster_updated",
        success: true,
      }),
    );
    const [, meldung] = notifyRoomGameplayWrite.mock.calls[0]!;
    // Der Kontostand haengt an der Abfindung — `home` muss mit aktualisiert werden.
    expect((meldung as { affectedViews: string[] }).affectedViews).toEqual(
      expect.arrayContaining(["home", "team", "contracts"]),
    );
  }, 15000);

  it("Solo laeuft weiter: ohne Raum entscheidet der Guard, nicht die Route", async () => {
    // Die Route darf NICHT selbst auf `roomCode` pruefen — sonst gaebe es zwei Stellen, die
    // "ist das ein Raum?" beantworten, und sie driften auseinander. Sie fragt immer, der Guard
    // laesst ausserhalb eines Raums durch.
    authorizeServerRoomWrite.mockReturnValue({ allowed: true, status: 200, reason: "ok", warnings: [] });
    const { POST } = await import("@/app/api/contracts/dissolution/route");
    const antwort = await POST(anfrage());

    expect(authorizeServerRoomWrite).toHaveBeenCalledTimes(1);
    expect(executeLocalContractDissolution).toHaveBeenCalledWith(
      expect.objectContaining({ saveId: "raum-save", teamId: "A-A", playerId: "p-1", decision: "accepted" }),
    );
    expect(antwort.status).toBe(200);
  }, 15000);
});
