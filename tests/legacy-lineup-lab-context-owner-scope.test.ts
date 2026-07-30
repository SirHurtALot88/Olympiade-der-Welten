/**
 * DIE EINSATZLISTEN-ROUTE DARF DEM BROWSER NICHT GLAUBEN, WER MAN IST.
 *
 * `GET /api/lineups/legacy/lab-context` entscheidet ueber `readOnly`, ob eine Einsatzliste bedienbar
 * ist — inklusive der Formkarten. Diese Entscheidung faellt ueber `canLocalUserManageTeam(gameState,
 * teamId, activeOwnerId)`. Beide Eingaben kamen bis zum Fix aus dem Query-String bzw. ohne
 * Besitzerbezug:
 *
 *   - `activeOwnerId` wurde aus `?activeOwnerId=` gelesen, sonst DEFAULT_ACTIVE_OWNER_ID. Ein
 *     umgeschriebener Link konnte also behaupten, jemand anderes zu sein.
 *   - Der Save wurde ohne `ownerId` aufgeloest. Fehlte die `saveId`, griff der global zuletzt aktive
 *     Save — bei zwei angemeldeten Spielern regelmaessig der des ANDEREN.
 *
 * Gemeldet wurde das als "ich habe ploetzlich nicht mehr die moeglichkeit formkarten einzusetzen",
 * und zwar auf dem EIGENEN Team: geprueft wurde gegen einen fremden Spielstand, in dem dieses Team
 * niemandem gehoert, also gesperrt.
 *
 * Die Mocks bilden die Lage nach: zwei Spieler, zwei Saves, ein globaler Aktiv-Zeiger, der auf den
 * falschen zeigt.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_ACTIVE_OWNER_ID, FRANKY_OWNER_ID } from "@/lib/foundation/team-control-settings";

const resolveSessionOwnerId = vi.fn(async (): Promise<string | null> => null);
const authEnabled = { value: true };

vi.mock("@/lib/auth/session", () => ({ resolveSessionOwnerId }));
vi.mock("@/lib/auth/config", () => ({ isAuthEnabled: () => authEnabled.value }));

/** Welche ownerId bei der Save-Aufloesung ankam — der eigentliche Pruefpunkt. */
const seenOwnerIds: Array<string | null | undefined> = [];

const CHRIS_SAVE = "save-chris";
const FRANKY_SAVE = "save-franky";

/** In Chris' Save fuehrt Chris das Team C-C; in Frankys Save gehoert C-C niemandem. */
function buildSave(saveId: string, ownerOfCC: string | null) {
  return {
    saveId,
    name: saveId,
    gameState: {
      season: { id: "season-1", matchdayIds: ["matchday-1"] },
      matchdayState: { matchdayId: "matchday-1" },
      teams: [{ teamId: "C-C" }, { teamId: "T-G" }],
      seasonState: {
        teamControlSettings: ownerOfCC
          ? { "C-C": { teamId: "C-C", controlMode: "manual", ownerId: ownerOfCC } }
          : {},
      },
    },
  };
}

vi.mock("@/lib/persistence/persistence-service", () => ({
  createPersistenceService: () => ({
    // Der GLOBALE Zeiger (ohne ownerId) zeigt auf Frankys Save — so wie auf dem echten Server, wo
    // der zuletzt gesetzte gewinnt.
    getActiveSave: (ownerId?: string | null) => {
      seenOwnerIds.push(ownerId);
      if (ownerId === DEFAULT_ACTIVE_OWNER_ID) return buildSave(CHRIS_SAVE, DEFAULT_ACTIVE_OWNER_ID);
      if (ownerId === FRANKY_OWNER_ID) return buildSave(FRANKY_SAVE, null);
      return buildSave(FRANKY_SAVE, null);
    },
    getSaveById: (saveId: string) =>
      saveId === CHRIS_SAVE ? buildSave(CHRIS_SAVE, DEFAULT_ACTIVE_OWNER_ID) : buildSave(FRANKY_SAVE, null),
    getSaveVersionMetadata: () => null,
  }),
}));

beforeEach(() => {
  seenOwnerIds.length = 0;
  resolveSessionOwnerId.mockReset();
  authEnabled.value = true;
});

afterEach(() => {
  vi.resetModules();
});

async function callRoute(query: string) {
  const { GET } = await import("@/app/api/lineups/legacy/lab-context/route");
  return GET(new Request(`http://localhost/api/lineups/legacy/lab-context?${query}`));
}

describe("Einsatzlisten-Route — die Identitaet kommt aus der Sitzung", () => {
  /**
   * DER KERN. Der Query-Parameter behauptet, Chris zu sein; die Sitzung sagt Franky. Vor dem Fix
   * gewann der Parameter — ein umgeschriebener Link haette so eine fremde Aufstellung als eigene
   * bedienbar gemacht.
   */
  it("ignoriert einen abweichenden activeOwnerId aus der URL, solange der Login an ist", async () => {
    resolveSessionOwnerId.mockResolvedValue(FRANKY_OWNER_ID);
    await callRoute(`teamId=C-C&activeOwnerId=${DEFAULT_ACTIVE_OWNER_ID}`);
    expect(seenOwnerIds).toContain(FRANKY_OWNER_ID);
    expect(seenOwnerIds).not.toContain(DEFAULT_ACTIVE_OWNER_ID);
  });

  /**
   * Ohne `saveId` griff bisher der globale Aktiv-Zeiger. Der Besitzer muss durchgereicht werden,
   * sonst bekommt der eine Spieler den Spielstand des anderen zu sehen.
   */
  it("reicht den Besitzer an die Save-Aufloesung durch, wenn keine saveId mitkommt", async () => {
    resolveSessionOwnerId.mockResolvedValue(DEFAULT_ACTIVE_OWNER_ID);
    await callRoute("teamId=C-C");
    expect(seenOwnerIds).toEqual([DEFAULT_ACTIVE_OWNER_ID]);
    // Die Gegenprobe ist der eigentliche Test: NICHT ohne Besitzer fragen.
    expect(seenOwnerIds).not.toContain(undefined);
  });

  /**
   * Das gemeldete Symptom, an der Stelle geprueft, an der es entsteht: Chris fragt nach seinem
   * eigenen Team, und die Route muss dafuer SEINEN Spielstand holen. Ohne den Fix landete sie bei
   * Frankys — und dort gehoert C-C niemandem, also war alles gesperrt.
   *
   * Bewusst wird hier die Save-AUSWAHL geprueft und nicht das `readOnly` der fertigen Antwort: dafuer
   * muesste ein vollstaendiger Spielstand samt Disziplin-Plan und Kaderdaten nachgebaut werden, und
   * ein Test, der zur Haelfte aus Attrappe besteht, prueft am Ende die Attrappe. Die Save-Auswahl ist
   * die Weiche, an der die Meldung entstand.
   */
  it("holt den Spielstand DES ANFRAGENDEN, nicht den global zuletzt aktiven", async () => {
    resolveSessionOwnerId.mockResolvedValue(DEFAULT_ACTIVE_OWNER_ID);
    await callRoute("teamId=C-C");
    expect(seenOwnerIds).toEqual([DEFAULT_ACTIVE_OWNER_ID]);

    // Gegenprobe mit dem anderen Spieler: derselbe Aufruf muss bei ihm einen ANDEREN Save treffen.
    seenOwnerIds.length = 0;
    resolveSessionOwnerId.mockResolvedValue(FRANKY_OWNER_ID);
    await callRoute("teamId=C-C");
    expect(seenOwnerIds).toEqual([FRANKY_OWNER_ID]);
  });

  /** Ohne Login gibt es keine Sitzung und genau einen Spieler — der bisherige Weg bleibt richtig. */
  it("bei abgeschaltetem Login gilt weiter der Query-Parameter", async () => {
    authEnabled.value = false;
    await callRoute(`teamId=C-C&activeOwnerId=${FRANKY_OWNER_ID}`);
    expect(seenOwnerIds).toContain(FRANKY_OWNER_ID);
    expect(resolveSessionOwnerId).not.toHaveBeenCalled();
  });
});
