/**
 * /api/draft — Rechte und Weiterleitung (Draft-Neubau, Stufe Kern, 18.11.).
 *
 * Wie bei den anderen Schreibrouten: `authorizeServerRoomWrite` mit der serverseitig aufgeloesten Identitaet, Team-
 * Aktionen gegen ein eigenes Team (`draft_pick`), Draft anlegen und Auto-Pick fuer ein FREMDES Team nur als Gastgeber
 * (`ai_picks_run_execute`, host-level). Die Logik selbst pruefen `liga-draft-modell.test.ts` und
 * `liga-draft-kern.test.ts`; hier geht es nur darum, dass die Route richtig fragt und richtig antwortet.
 *
 * Review #1619: Schalter aus -> Route schreibt nichts (S1), `starten` uebergibt die Menschen als Selbst-Picker (S1),
 * `maxPicks` hoechstens 8 (A3), `erwarteteNr` Pflicht (A6), `mein` nur fuer das eigene Team (A7), `abbrechen` (A2).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";

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
  brecheLigaDraftAb: vi.fn(),
  istHintergrundLaufAktiv: vi.fn(() => false),
}));
const ansicht = vi.hoisted(() => ({ baueLigaDraftAnsicht: vi.fn<(input: { betrachterTeamId: string | null }) => null>(() => null) }));
const stand = vi.hoisted(() => ({ gameState: null as unknown }));

function spielstand(ligaDraftStatus: "laeuft" | "nachzug" | "fertig" | null, verlauf = 7): GameState {
  return {
    season: { id: "season-1" },
    teams: [{ teamId: "M-M" }, { teamId: "F-F" }, { teamId: "A-A" }],
    seasonState: {
      teamControlSettings: {
        "M-M": { teamId: "M-M", controlMode: "manual", ownerId: "user_local" },
        "F-F": { teamId: "F-F", controlMode: "manual", ownerId: "franky_local" },
        "A-A": { teamId: "A-A", controlMode: "ai" },
      },
      ...(ligaDraftStatus
        ? { ligaDraft: { saisonId: "season-1", status: ligaDraftStatus, verlauf: Array.from({ length: verlauf }, () => ({})) } }
        : {}),
    },
  } as unknown as GameState;
}

vi.mock("@/lib/room/server-authoritative-write-guard", () => auth);
vi.mock("@/lib/room/room-gameplay-write-notifier", () => ({ notifyRoomGameplayWrite: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ resolveAuthoritativeWriteOwnerId: vi.fn(async () => "user_local") }));
vi.mock("@/lib/persistence/persistence-service", () => ({
  createPersistenceService: () => ({ getSaveById: () => ({ saveId: "s", gameState: stand.gameState }) }),
}));
vi.mock("@/lib/draft/liga-draft-ansicht", () => ansicht);
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

const ERLAUBT = { allowed: true, room: null, participant: null, ownership: null, warnings: [] };

describe("/api/draft", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OLY_LIGA_DRAFT_MODUS = "einzelschritt";
    stand.gameState = spielstand("laeuft");
    auth.authorizeServerRoomWrite.mockReset();
    auth.authorizeServerRoomWrite.mockReturnValue(ERLAUBT);
  });
  afterEach(() => {
    delete process.env.OLY_LIGA_DRAFT_MODUS;
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
    const { status, json } = await post({ saveId: "s", teamId: "A-A", aktion: "auslassen", erwarteteNr: 7 });
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
    const { status, json } = await post({ saveId: "s", teamId: "M-M", aktion: "pick", playerId: "p1", erwarteteNr: 7 });
    expect(status).toBe(409);
    expect(json.error).toBe("nicht_am_zug");
  });

  it("Auto-Pick fuer ein fremdes Team, `starten` und `abbrechen` sind Gastgeber-Aktionen", async () => {
    dienst.setzeMenschAutoPick.mockReturnValue({});
    await post({ saveId: "s", teamId: "M-M", aktion: "auto_pick", zielTeamId: "F-F", an: true, erwarteteNr: 7 });
    expect(auth.authorizeServerRoomWrite).toHaveBeenCalledWith(expect.objectContaining({ teamId: null, action: "ai_picks_run_execute" }));
    expect(dienst.setzeMenschAutoPick).toHaveBeenCalledWith(expect.objectContaining({ teamId: "F-F", an: true, erwarteteNr: 7 }));

    dienst.brecheLigaDraftAb.mockReturnValue({});
    await post({ saveId: "s", aktion: "abbrechen", erwarteteNr: 7 });
    expect(auth.authorizeServerRoomWrite).toHaveBeenLastCalledWith(expect.objectContaining({ teamId: null, action: "ai_picks_run_execute" }));
    expect(dienst.brecheLigaDraftAb).toHaveBeenCalledWith(expect.objectContaining({ saveId: "s", erwarteteNr: 7 }));

    dienst.starteLigaDraft.mockReturnValue({});
    stand.gameState = spielstand(null);
    await post({ saveId: "s", aktion: "starten" });
    expect(auth.authorizeServerRoomWrite).toHaveBeenLastCalledWith(expect.objectContaining({ action: "ai_picks_run_execute" }));
  });

  it("eigener Auto-Pick und KI-Schritt brauchen ein eigenes Team", async () => {
    dienst.laufeKiZuege.mockReturnValue({ eintraege: [], draft: {}, halt: "mensch_am_zug" });
    const ohneTeam = await post({ saveId: "s", aktion: "ki_schritt", erwarteteNr: 7 });
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

  it("S1: Schalter AUS -> keine Aktion schreibt (auch `starten` nicht), nur `abbrechen` bleibt als Ausweg", async () => {
    process.env.OLY_LIGA_DRAFT_MODUS = "block"; // Schalter aus = Rueckweg Blocklauf (Standard seit 19.11.: Einzelschritt)
    for (const aktion of ["starten", "ki_schritt", "ki_hintergrund", "pick", "auslassen", "fertig", "ueberspringen", "auto_pick"]) {
      const { status, json } = await post({ saveId: "s", teamId: "M-M", aktion, playerId: "p1", variante: "A", erwarteteNr: 7 });
      expect(status, aktion).toBe(409);
      expect(json.error, aktion).toBe("liga_draft_modus_aus");
    }
    for (const fn of Object.values(dienst)) if (fn !== dienst.istHintergrundLaufAktiv) expect(fn).not.toHaveBeenCalled();
    expect(auth.authorizeServerRoomWrite).not.toHaveBeenCalled();
    // Ausweg: ein liegengebliebener Draft laesst sich auch mit Schalter aus abbrechen (Gastgeber).
    dienst.brecheLigaDraftAb.mockReturnValue({});
    const abbruch = await post({ saveId: "s", aktion: "abbrechen", erwarteteNr: 7 });
    expect(abbruch.status).toBe(200);
    expect(dienst.brecheLigaDraftAb).toHaveBeenCalledTimes(1);
  });

  it("S1: `starten` uebergibt die menschlichen Teams als Selbst-Picker (nicht Auto-Pick fuer alle)", async () => {
    stand.gameState = spielstand(null);
    dienst.starteLigaDraft.mockReturnValue({});
    const { status } = await post({ saveId: "s", aktion: "starten" });
    expect(status).toBe(200);
    expect(dienst.starteLigaDraft).toHaveBeenCalledWith(expect.objectContaining({ selbstPickendeTeamIds: ["M-M", "F-F"] }));
  });

  it("S1: alle Aktionen ausser `starten` brauchen einen laufenden Draft", async () => {
    stand.gameState = spielstand("fertig");
    const { status, json } = await post({ saveId: "s", teamId: "M-M", aktion: "ki_schritt", erwarteteNr: 7 });
    expect(status).toBe(409);
    expect(json.error).toBe("draft_laeuft_nicht");
    stand.gameState = spielstand(null);
    expect((await post({ saveId: "s", teamId: "M-M", aktion: "fertig", erwarteteNr: 0 })).json.error).toBe("draft_laeuft_nicht");
    expect((await post({ saveId: "s", aktion: "abbrechen", erwarteteNr: 0 })).json.error).toBe("liga_draft_fehlt");
    expect(dienst.laufeKiZuege).not.toHaveBeenCalled();
    expect(dienst.bucheMenschFertig).not.toHaveBeenCalled();
    expect(dienst.brecheLigaDraftAb).not.toHaveBeenCalled();
  });

  it("A3: `maxPicks` wird auf 8 begrenzt (und mindestens 1)", async () => {
    dienst.laufeKiZuege.mockReturnValue({ eintraege: [], draft: {}, halt: "max_picks" });
    await post({ saveId: "s", teamId: "M-M", aktion: "ki_schritt", maxPicks: 5000, erwarteteNr: 7 });
    expect(dienst.laufeKiZuege).toHaveBeenLastCalledWith(expect.objectContaining({ maxPicks: 8 }));
    await post({ saveId: "s", teamId: "M-M", aktion: "ki_schritt", maxPicks: -3, erwarteteNr: 7 });
    expect(dienst.laufeKiZuege).toHaveBeenLastCalledWith(expect.objectContaining({ maxPicks: 1 }));
  });

  it("A6: `erwarteteNr` ist Pflicht fuer jede schreibende Aktion ausser `starten`", async () => {
    for (const aktion of ["ki_schritt", "ki_hintergrund", "pick", "auslassen", "fertig", "ueberspringen", "auto_pick", "abbrechen"]) {
      const { status, json } = await post({ saveId: "s", teamId: "M-M", aktion, playerId: "p1", variante: "A" });
      expect(status, aktion).toBe(400);
      expect(json.error, aktion).toBe("erwarteteNr_fehlt");
    }
    // `ki_hintergrund` prueft den Stand selbst, bevor es anstoesst.
    const veraltet = await post({ saveId: "s", teamId: "M-M", aktion: "ki_hintergrund", erwarteteNr: 3 });
    expect(veraltet.json.error).toBe("draft_stand_veraltet");
    expect(dienst.laufeKiImHintergrund).not.toHaveBeenCalled();
    dienst.bucheMenschFertig.mockReturnValue({});
    dienst.bucheMenschUeberspringen.mockReturnValue({});
    await post({ saveId: "s", teamId: "M-M", aktion: "fertig", erwarteteNr: 7 });
    await post({ saveId: "s", teamId: "M-M", aktion: "ueberspringen", variante: "B", erwarteteNr: 7 });
    expect(dienst.bucheMenschFertig).toHaveBeenCalledWith(expect.objectContaining({ teamId: "M-M", erwarteteNr: 7 }));
    expect(dienst.bucheMenschUeberspringen).toHaveBeenCalledWith(expect.objectContaining({ variante: "B", erwarteteNr: 7 }));
  });

  it("A7: GET liefert `mein` nur fuer ein Team mit Schreibrecht, sonst die oeffentliche Sicht", async () => {
    const { GET } = await import("@/app/api/draft/route");
    auth.authorizeServerRoomWrite.mockReturnValue({ allowed: false, status: 403, reason: "local_team_not_owned_or_ai_controlled", warnings: [] });
    const fremd = await GET(new Request("http://x/api/draft?saveId=s&teamId=F-F"));
    expect(fremd.status).toBe(200);
    expect(auth.authorizeServerRoomWrite).toHaveBeenLastCalledWith(
      expect.objectContaining({ saveId: "s", teamId: "F-F", action: "draft_pick", activeOwnerId: "user_local" }),
    );
    expect(ansicht.baueLigaDraftAnsicht).toHaveBeenLastCalledWith(expect.objectContaining({ betrachterTeamId: null }));

    auth.authorizeServerRoomWrite.mockReturnValue(ERLAUBT);
    await GET(new Request("http://x/api/draft?saveId=s&teamId=M-M&roomCode=R1&participantId=p&seatToken=t"));
    expect(auth.authorizeServerRoomWrite).toHaveBeenLastCalledWith(
      expect.objectContaining({ roomCode: "R1", participantId: "p", seatToken: "t", teamId: "M-M" }),
    );
    expect(ansicht.baueLigaDraftAnsicht).toHaveBeenLastCalledWith(expect.objectContaining({ betrachterTeamId: "M-M" }));

    // Ohne teamId: oeffentliche Sicht, keine Rechtefrage.
    auth.authorizeServerRoomWrite.mockClear();
    await GET(new Request("http://x/api/draft?saveId=s"));
    expect(auth.authorizeServerRoomWrite).not.toHaveBeenCalled();
    expect(ansicht.baueLigaDraftAnsicht).toHaveBeenLastCalledWith(expect.objectContaining({ betrachterTeamId: null }));
  });

  it("A7: Gastgeber-Aktion -> die Antwort traegt `mein` nur, wenn der Aufrufer `teamId` auch als Team schreiben darf", async () => {
    dienst.setzeMenschAutoPick.mockReturnValue({});
    auth.authorizeServerRoomWrite.mockImplementation((input: { teamId: string | null }) =>
      input.teamId === "M-M" ? { allowed: false, status: 403, reason: "nicht_eigenes", warnings: [] } : ERLAUBT,
    );
    const { status } = await post({ saveId: "s", teamId: "M-M", aktion: "auto_pick", zielTeamId: "F-F", an: true, erwarteteNr: 7 });
    expect(status).toBe(200);
    expect(ansicht.baueLigaDraftAnsicht).toHaveBeenLastCalledWith(expect.objectContaining({ betrachterTeamId: null }));
  });
});
