/**
 * /api/draft — Rechte und Weiterleitung (Draft-Neubau, Stufe Kern, 18.11.).
 *
 * Wie bei den anderen Schreibrouten: `authorizeServerRoomWrite` mit der serverseitig aufgeloesten Identitaet, Team-
 * Aktionen gegen ein eigenes Team (`draft_pick`), Draft anlegen und Auto-Pick fuer ein FREMDES Team nur als Gastgeber
 * (`ai_picks_run_execute`, host-level). Die Logik selbst pruefen `liga-draft-modell.test.ts` und
 * `liga-draft-kern.test.ts`; hier geht es nur darum, dass die Route richtig fragt und richtig antwortet.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ authorizeServerRoomWrite: vi.fn() }));
const dienst = vi.hoisted(() => ({
  bucheMenschPick: vi.fn(),
  bucheMenschAuslassen: vi.fn(),
  bucheMenschFertig: vi.fn(),
  bucheMenschUeberspringen: vi.fn(),
  setzeMenschAutoPick: vi.fn(),
  laufeKiZuege: vi.fn(),
  laufeKiImHintergrund: vi.fn(),
  starteLigaDraft: vi.fn(),
  istHintergrundLaufAktiv: vi.fn(() => false),
}));

vi.mock("@/lib/room/server-authoritative-write-guard", () => auth);
vi.mock("@/lib/room/room-gameplay-write-notifier", () => ({ notifyRoomGameplayWrite: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ resolveAuthoritativeWriteOwnerId: vi.fn(async () => "user_local") }));
vi.mock("@/lib/persistence/persistence-service", () => ({
  createPersistenceService: () => ({ getSaveById: () => ({ saveId: "s", gameState: { season: { id: "season-1" }, seasonState: {} } }) }),
}));
vi.mock("@/lib/draft/liga-draft-ansicht", () => ({ baueLigaDraftAnsicht: () => null }));
vi.mock("@/lib/draft/liga-draft-dienst", async () => {
  class LigaDraftFehler extends Error {
    constructor(
      readonly code: string,
      readonly status = 409,
    ) {
      super(code);
    }
  }
  return { ...dienst, LigaDraftFehler };
});

async function post(body: Record<string, unknown>) {
  const { POST } = await import("@/app/api/draft/route");
  const antwort = await POST(new Request("http://x/api/draft", { method: "POST", body: JSON.stringify(body) }));
  return { status: antwort.status, json: (await antwort.json()) as Record<string, unknown> };
}

describe("/api/draft", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.authorizeServerRoomWrite.mockReturnValue({ allowed: true, room: null, participant: null, ownership: null, warnings: [] });
  });

  it("Pick: Team-Recht `draft_pick` fuer das eigene Team, Identitaet vom Server", async () => {
    dienst.bucheMenschPick.mockReturnValue({ draft: {}, transferId: "t1", abloese: 5, gehalt: 1 });
    const { status, json } = await post({ saveId: "s", teamId: "M-M", aktion: "pick", playerId: "p1", erwarteteNr: 7, activeOwnerId: "gefaelscht" });
    expect(status).toBe(200);
    expect(json).toMatchObject({ success: true, transferId: "t1" });
    expect(auth.authorizeServerRoomWrite).toHaveBeenCalledWith(
      expect.objectContaining({ saveId: "s", teamId: "M-M", action: "draft_pick", activeOwnerId: "user_local" }),
    );
    expect(dienst.bucheMenschPick).toHaveBeenCalledWith(expect.objectContaining({ teamId: "M-M", playerId: "p1", erwarteteNr: 7 }));
  }, 30_000);

  it("verweigerte Rechte kommen mit Status und Grund zurueck, der Dienst wird nicht gerufen", async () => {
    auth.authorizeServerRoomWrite.mockReturnValue({ allowed: false, status: 403, reason: "local_team_not_owned_or_ai_controlled", warnings: [] });
    const { status, json } = await post({ saveId: "s", teamId: "A-A", aktion: "auslassen" });
    expect(status).toBe(403);
    expect(json.error).toBe("local_team_not_owned_or_ai_controlled");
    expect(dienst.bucheMenschAuslassen).not.toHaveBeenCalled();
  });

  it("Draft-Fehler werden zu ihrem Status (z. B. 409 nicht am Zug)", async () => {
    const { LigaDraftFehler } = (await import("@/lib/draft/liga-draft-dienst")) as unknown as {
      LigaDraftFehler: new (code: string, status?: number) => Error;
    };
    dienst.bucheMenschPick.mockImplementation(() => {
      throw new LigaDraftFehler("nicht_am_zug", 409);
    });
    const { status, json } = await post({ saveId: "s", teamId: "M-M", aktion: "pick", playerId: "p1" });
    expect(status).toBe(409);
    expect(json.error).toBe("nicht_am_zug");
  });

  it("Auto-Pick fuer ein fremdes Team und `starten` sind Gastgeber-Aktionen", async () => {
    dienst.setzeMenschAutoPick.mockReturnValue({});
    await post({ saveId: "s", teamId: "M-M", aktion: "auto_pick", zielTeamId: "F-F", an: true });
    expect(auth.authorizeServerRoomWrite).toHaveBeenLastCalledWith(expect.objectContaining({ teamId: null, action: "ai_picks_run_execute" }));
    expect(dienst.setzeMenschAutoPick).toHaveBeenCalledWith(expect.objectContaining({ teamId: "F-F", an: true }));

    dienst.starteLigaDraft.mockReturnValue({});
    await post({ saveId: "s", aktion: "starten" });
    expect(auth.authorizeServerRoomWrite).toHaveBeenLastCalledWith(expect.objectContaining({ action: "ai_picks_run_execute" }));
  });

  it("eigener Auto-Pick und KI-Schritt brauchen ein eigenes Team", async () => {
    dienst.laufeKiZuege.mockReturnValue({ eintraege: [], draft: {}, halt: "mensch_am_zug" });
    const ohneTeam = await post({ saveId: "s", aktion: "ki_schritt" });
    expect(ohneTeam.status).toBe(400);
    const mitTeam = await post({ saveId: "s", teamId: "M-M", aktion: "ki_schritt", maxPicks: 3, erwarteteNr: 2 });
    expect(mitTeam.status).toBe(200);
    expect(mitTeam.json.halt).toBe("mensch_am_zug");
    expect(dienst.laufeKiZuege).toHaveBeenCalledWith(expect.objectContaining({ maxPicks: 3, erwarteteNr: 2 }));
  });

  it("unbekannte Aktion: 400", async () => {
    const { status } = await post({ saveId: "s", teamId: "M-M", aktion: "alles_kaufen" });
    expect(status).toBe(400);
  });
});
